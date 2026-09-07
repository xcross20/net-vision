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

---

## Amendment 1 — A2 invariants (event-local writers)

**Status:** Accepted (A2 spec addendum: `docs/data/SPEC_MARKET_DATA_ARCHITECTURE_V2_A2.md`)
**Date:** 2026-09-06
**Supersedes in part:** the “Event-local writes (A2, not A1)” stub in §Decision above, the implicit assumption in `pg.ts::upsertNormalized` that DELETE-then-insert is an acceptable write pattern, and the in-memory `MarketEvent.id` constructed independently by `restEventToMarketEvent` and `streamMessageToMarketEvent`.

### Context (what A1 left open)

The existing event-local reducer (`apps/web/lib/index/apply-event.ts`) already applies a single OpenSea event to a single token without walking the rest of the collection. A1 added the `market_events` journal table. What A1 did **not** do:

- Persist events to `market_events` as part of the apply path — the table exists but is never written.
- Make `applyMarketEvent` atomic with the SQL projection — `rememberMarketEvent` then `writeListing` then `upsertToken` then `ingestSales` are independent in-memory writes with no rollback.
- Normalize Stream vs REST to one canonical source event identity — `restEventToMarketEvent.id` and `streamMessageToMarketEvent.id` are constructed with different suffixes, so the same upstream order arrives as two different in-memory dedup keys.
- Reject out-of-order events — `applyObservation` blindly applies the new observation, so a REST replay with an older listing arriving after a Stream cancel will resurrect the cancelled ask.
- Stop calling `upsertNormalized` (`DELETE FROM token_categories` / `token_facets` / `floor_history` then full rebuild) from the hot path. Today this is mostly shielded by `scheduleSaveSnapshotToPg({normalized: false})`, but `importSnapshot` and any future caller can still trigger it.

### Decision — eight invariants for A2

These invariants bind every code path that writes market state from A2 onward. They are enforced by the repository contract in the A2 spec addendum, by the audit gate at the end of A2, and by code review.

1. **Event ingest and state projection are atomic.** One event ⇒ one transaction that contains (a) `INSERT market_events ON CONFLICT (source, source_event_id) DO NOTHING`, (b) the conditional projection writes (token, facets, market state, sale, attribution, worker state), and (c) the commit. A crash anywhere in the path leaves either the full effect or no effect — never an event recorded without its projection, or a projection without an event row.

2. **Stream and REST representations of the same OpenSea event dedupe to one canonical source event identity.** The canonical identity is `(source, source_event_id)` where `source = 'opensea'` (single canonical source across transports) and `source_event_id` is the upstream-stable OpenSea event identity (order hash when present, transaction hash + log index otherwise). The in-memory `MarketEvent.id` continues to exist for legacy dedup but is **derived** from `(transport, source_event_id, kind, occurredAt)` — never the canonical key. Stream `item_listed` and REST `listing` for the same upstream order MUST resolve to the same `(source, source_event_id)` and therefore the same `market_events` row.

3. **Older or out-of-order market events cannot overwrite newer market state.** `token_market_state` carries `state_event_at` (the `occurred_at` of the event whose projection is currently in state) and `state_event_id` (deterministic tie-breaker for equal timestamps). A new event is applied to projection only if `(new.occurred_at, new.source_event_id)` is strictly newer than the stored `(state_event_at, state_event_id)`. A reconciliation that has *fresh live verification* (a successful REST best-listing lookup with `verifiedAt` strictly newer than the stored `state_event_at`) may override; otherwise it is rejected. This is the only legal override.

4. **Reconciliation may override event state only with a fresher authoritative verification timestamp.** A REST best-listing lookup that returned a current ask (or a confirmed 404 series) carries its own `verifiedAt`. If `verifiedAt > token_market_state.state_event_at`, reconciliation may set state regardless of event ordering. If not, the lookup is treated as stale and recorded but does not override. No override is allowed for any other reason (operator push, “looks wrong”, time-based decay).

5. **A2 performs event-local / incremental SQL writes only. Full normalized-table rebuilds are not called from hot paths.** `pg.ts::upsertNormalized` (the `DELETE FROM token_categories / token_facets / floor_history` then full rebuild) is moved out of the apply pipeline. It remains available **only** to admin scripts (e.g. `scripts/import-market-index.ts`) and only behind an explicit `--rebuild-normalized` flag, and it is the responsibility of the caller to ensure no A2 writers are racing the rebuild. A2 introduces no new callers of the full-rebuild path.

6. **`token_facets` remains canonical membership; `token_categories` is rebuildable only.** A2 never writes to `token_categories` from the hot path. Reads in A4 will join `token_facets ⋈ token_market_state`. `token_categories` is re-populated only by the A4 maintenance job that materializes the lookup from `token_facets`; the row count is allowed to drift between maintenance runs.

7. **All mutations are collection-scoped.** Every INSERT / UPDATE carries an explicit `collection_id` (resolved from `BUTTON_PRESSER_COLLECTION_ID` or the future collection registry, not from caller-supplied strings). Composite uniqueness uses `(collection_id, token_id, ...)` — never `token_id` alone. The old `ON CONFLICT (token_id)` PKs in `pg.ts` are flagged as a **technical debt note** in A2; they are NOT dropped until A5 (per A1’s “dropping PKs before A2 is a P0” recall) and the A2 code is written to be collection-aware so the eventual PK drop is a constraint-only migration.

8. **Existing `index_blob` writes continue temporarily for shadow comparison and recovery.** `scheduleSaveSnapshotToPg` keeps saving the blob on the hot path with the existing revision-guard. A2 does not switch any read path. A2 adds SQL writes alongside the blob writes; A3 introduces a shadow parity verifier that compares the two; the blob is retired in A7.

### Riskiest unknown (A2)

Whether the existing `applyMarketEvent` path, which currently mutates the in-memory `IndexSnapshot` directly, can be refactored into a transactional SQL write without changing observable behavior during the dual-write window. Mitigation: A2 keeps the in-memory mutation as the source of the *next* `saveIndex()` blob write, and the SQL write is the durable record. Tests assert that after the SQL transaction completes, the next `saveIndex()` produces a blob whose snapshot, when re-loaded, agrees with the SQL state on the affected tokens.

### Revisit if (A2)

- Staging shadow parity (A3) shows systematic disagreement on out-of-order events, meaning the rejection rule is too strict or too loose.
- An OpenSea event is observed in the wild whose canonical `source_event_id` cannot be derived from `order_hash` or `transaction_hash` (e.g. metadata updates without an order hash). Then widen the canonical identity to include a tuple of `(chain, contract, token_id, kind, occurred_at)` as a fallback.
- Worker memory or DB write rate exceeds the budget once both blob and SQL writes happen per event. Then compress the blob write frequency on hot ticks (already true: `SAVE_EVERY` gate) and consider coalescing market_state writes per token.
