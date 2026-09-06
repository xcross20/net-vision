# ADR 0004: Promote normalized Postgres to market authority

**Status:** Accepted (A1 implementing; A2–A7 planned)  
**Date:** 2026-09-06  
**Spec:** `docs/data/SPEC_MARKET_DATA_ARCHITECTURE_V2.md`  
**Supersedes in part:** ADR 0002 §2 (“PostgreSQL authoritative for worker cursors… JSON remains local/dev fallback”) — the *tables* were built, but the *request path* remained the blob. This ADR completes that intent.

## Context

ADR 0002 made Postgres the persistence for worker state and dual-wrote a giant `IndexSnapshot` JSON blob (`index_blob`) plus normalized tables (`tokens`, `token_facets`, `token_categories`, `token_market_state`, `sales`, …).

Verified in `apps/web/lib/index/pg.ts`:

- Comment on disk: *“the in-memory IndexSnapshot remains the request-path source of truth.”*
- Hot path: `scheduleSaveSnapshotToPg` writes **blob only** (`normalized: false`) because a full normalized rebuild of ~60k rows every save would stall the worker.
- When normalized upsert *does* run, it `DELETE FROM token_categories` / `token_facets` / `floor_history` and rebuilds from the snapshot.

So the normalized model is a recovery projection, not an operational store. Web still `peekSnapshotRevisionFromPg` → download payload → `TokenCatalog`.

That will not survive Button Presser + NetNet Gear + category markets + sales history: `tokens.token_id INTEGER PRIMARY KEY` makes `#68` globally unique.

Numbers (verified): official supply 62,093; discovery max 62,095; chain id 1311; contract `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2`.

## Decision

Keep **Next.js + one market-worker + Postgres**. Do not add Redis/Kafka/ES/ClickHouse.

Promote the existing normalized tables to **authoritative operational state** in slices A1–A7. Keep `index_blob` as a **checkpoint / disaster-recovery / shadow-comparison** artifact until A7.

### Data model (A1)

```
ecosystems 1──* collections 1──* tokens
                     │
                     ├── token_facets          (canonical membership)
                     ├── token_categories      (derived lookup; rebuildable from facets)
                     ├── token_market_state    (listing_state ∈ {UNKNOWN,LISTED,UNLISTED_VERIFIED,STALE})
                     ├── sales / sale_attributions / floor_history
                     └── market_events         (idempotent log; UNIQUE(source, source_event_id))
```

Natural key for a token is `(collection_id, token_id)`. A1 **adds** `collection_id` (NOT NULL DEFAULT `button-presser`) and collection-scoped unique indexes. A1 **does not drop** existing `token_id` primary keys — current writers use `ON CONFLICT (token_id)`. Dropping those PKs before A2 is a P0.

Seed now (seams, not product):

- ecosystem `helix`
- collection `button-presser` from `@net-vision/chain-config`

Do not seed NetNet Gear.

### Facet vs category ownership

| Table | Role |
| --- | --- |
| `token_facets` | Canonical membership (`family`, `slug`, `source`) |
| `token_categories` | Materialized category-slug lookup derived from facets |

Category listed count / floor / grid in A4 query `token_facets ⋈ token_market_state`, not a second in-memory tally.

### Event-local writes (A2, not A1)

```
event → dedupe via market_events → upsert one token_market_state row
```

Not: mutate snapshot → serialize 62k tokens → optional full normalized rebuild.

### Read cutover (A4–A6)

`MARKET_READ_MODEL=blob|sql`, production default `blob`. SQL mode staging-only until parity PASS.

### Seams to introduce later (not A1 code)

`OpenSeaGateway` · `MarketWriter` · `MarketRepository` · `CategoryRepository` · `CollectionRepository` · `MarketReadService` · `MarketWorker` orchestration. A1 does not split `OpenSeaMarketSource`.

## Alternatives considered

### A. Leave the blob as request-path truth until metrics hurt

- Pros: zero migration risk; walker can finish coverage on the current path.
- Cons: NetNet Gear cannot share `token_id` PK; every new surface re-implements catalog coherence; we already pay dual-write cost without dual-read benefit.
- **Kill fact:** the founder’s product sequence (Gear, portfolio, category markets, alerts) makes the blob the architecture of an ecosystem deserialize. Waiting until after Gear is the expensive order.

### B. Ground-up rewrite (new services, queues, warehouses)

- Pros: clean paper architecture.
- Cons: throws away a working reference implementation and the coverage walk in flight; resume-driven.
- **Kill fact:** Postgres + worker is sufficient; the defect is *how* we use Postgres, not the topology.

### C. Promote existing tables now, identity + events first, blob retained (chosen)

- Pros: reuses schema we already have; expand/contract; staging cutover; Helix-ready keys before Gear.
- Cons: two models in parallel until A6; discipline required not to merge SQL reads to `main` early.
- Kill fact against skipping identity: Gear token 68 vs Button 68.

## Consequences

**Verified**

- Additive `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` matches how `ensureSchema()` already migrates.
- Hot path does not touch normalized tables today, so A1 DDL on those tables does not change listing freshness.
- `CREATE TABLE IF NOT EXISTS tokens (token_id INTEGER PRIMARY KEY)` will **not** change an existing table’s PK — explicit ALTER is required later (A2).

**Recalled**

- Full-table `DELETE FROM token_facets` on normalized upsert is incompatible with event-local writes; A2 must stop calling that path.

**Guess**

- `ALTER TABLE … ADD COLUMN … DEFAULT 'button-presser'` on ~62k rows is a catalog-only rewrite on modern Postgres (PG 11+) and should be seconds, not minutes. Still: apply on staging first.

## Revisit if

- Staging parity (A3) shows systematic SQL/blob disagreement that is not a bug in one side — then stop cutover and re-open ownership.
- Postgres query p95 for category grids exceeds the A4 budget after real volume — then consider materialized category stats, still not Redis.
- A second collection is scheduled before A2 lands — **block the collection**, do not insert under `token_id` PK.

## A1 implementation notes

- Source of V2 DDL: `apps/web/lib/index/schema-v2.ts` (inlined SQL, same reason as `pg.ts`: Nixpacks must not lose a loose `.sql` at runtime).
- `apps/web/lib/index/schema.sql` is the operator-readable copy.
- Production `main` does not receive A1 until staging applies it and the worker stays healthy.
