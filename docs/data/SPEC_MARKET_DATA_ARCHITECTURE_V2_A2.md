# SPEC: Market Data Architecture V2 — A2 (Event-Local SQL Writers)

**Status:** Drafted; pending approval before implementation
**Date:** 2026-09-06
**Class:** architecture (one-way door — DB rows written by these writers persist)
**Hats:** PM → Architect → Staff → Implementer → QA → Reviewer → SRE → Tech Lead
**Amends:** `docs/data/SPEC_MARKET_DATA_ARCHITECTURE_V2.md` (the A2 row of the slice table) and ADR 0004 (Amendment 1)

This spec is the bounded delivery objective for A2 only. A1 is shipped. A3–A7 are not this slice.

---

## Problem (this slice)

A1 made `market_events` an idempotent log table and added collection identity. A1 did **not** write anything to that log or to `token_market_state` from the event path. The hot path today is:

1. `streamMessageToMarketEvent` / `restEventToMarketEvent` parse a payload into an in-memory `MarketEvent`.
2. `applyMarketEvent` calls `wasMarketEventSeen` (in-memory dedup by `event.id`), then `writeListing` / `upsertToken` / `ingestSales` / `persistNftMetadata`.
3. Eventually `scheduleSaveSnapshotToPg({normalized: false})` fires and writes only the `index_blob` (revision-guarded).
4. `upsertNormalized` (full-table DELETE then rebuild of `token_categories` / `token_facets` / `floor_history`) is reachable through `importSnapshot` and is **not** called from the hot path today, but remains a footgun.

What this slice fixes:

- No event row exists in `market_events`, so reconnect recovery, replay, and the “why did this change” audit trail are impossible.
- Stream `item_listed` and REST `listing` for the same upstream order produce different `event.id` values, so the in-memory dedup does not actually dedupe across transports.
- A REST replay that arrives out of sequence will resurrect a cancelled ask because `applyObservation` applies blindly.
- A crash between `rememberMarketEvent` and `writeListing` leaves an inconsistent state.
- A2 is the last slice before SQL becomes authoritative; if writers are not collection-aware now, the eventual PK contract drop in A5 will be a data migration.

## Objective (this slice)

Promote the existing event-local reducer to a transactional SQL writer that:

- Persists each event to `market_events` with a canonical `(source, source_event_id)` identity.
- Applies the projection in the same transaction.
- Rejects older events, unless reconciliation supplies a fresher verification timestamp.
- Continues to maintain `index_blob` writes for shadow comparison and disaster recovery.

**No user-visible behavior change.** No SQL web reads. No `MARKET_READ_MODEL` switch. No production-cutover signal.

## Semantic owners (unchanged from A1)

| Fact | Authority during and after A2 |
| --- | --- |
| `collection.totalSupply` | Plate `officialExistingSupply` on the `collections` row |
| `collection.listedVerified` | `token_market_state.listing_state = LISTED` only |
| `collection.floor` | MIN LISTED `best_price_decimal` in that collection |
| `category.listedVerified` | LISTED rows joined to canonical `token_facets` |
| Listing states | `UNKNOWN \| LISTED \| UNLISTED_VERIFIED \| STALE` |
| Wallet execution | Decoded calldata + policy (untouched) |

`token_facets` canonical; `token_categories` rebuildable only. `market_events` is the durable record of what the worker was told.

## Acceptance claims (A2 only — this slice)

1. Every event the worker applies (Stream or REST) is written to `market_events` exactly once per canonical `(source, source_event_id)`.
2. A Stream `item_listed` and a REST `listing` for the same upstream order resolve to the same `source_event_id`, and only one `market_events` row exists for the order.
3. A REST `cancelled` arriving after a Stream `item_cancelled` with a strictly newer `occurred_at` does not regress `token_market_state.listing_state` back to `LISTED`.
4. A REST best-listing lookup with `verifiedAt > token_market_state.state_event_at` overrides older event state; one with `verifiedAt ≤ state_event_at` does not.
5. `token_market_state` is updated by single-row upsert (`upsertTokenMarketState`), not by `DELETE FROM` then full re-insert.
6. `token_facets` membership is updated token-locally (`replaceTokenFacetsForToken`), not by `DELETE FROM token_facets` then full rebuild.
7. All writer SQL is collection-scoped (`collection_id` present in every INSERT / UPDATE).
8. `index_blob` writes continue and the in-memory `IndexSnapshot` continues to be the source of `saveIndex()`.
9. `upsertNormalized` (the full-rebuild function) is no longer reachable from any hot-path call site. It is only callable from admin scripts, and only with an explicit `--rebuild-normalized` flag.
10. Every method in the repository contract has at least one test that exercises the path it owns.

## Non-goals (this slice)

- SQL web reads (A4). The web app still reads `index_blob` via `loadSnapshotFromPg`.
- Switching production to `MARKET_READ_MODEL=sql` (A5/A6).
- Dropping `token_id` PKs (deferred to A5; A2 code is collection-aware so the eventual drop is a no-op behavior change).
- Shadow parity verifier (A3) — A3 reads the SQL writes A2 produces.
- Replacing `TokenCatalog` or `OpenSeaMarketSource` (A7).
- Any user-visible UI, listings, or trading behavior change.
- Any new collection, including NetNet Gear.

## Door class

**One-way.** The `market_events` rows written by these writers will become the audit trail and replay source for everything from A3 onward. The projection rules (out-of-order rejection, reconciliation override) are the rules the system runs under — wrong rules produce wrong state that consumers cannot easily disprove.

---

## Scope: event-local SQL writers only

In scope:

- New file: `apps/web/lib/index/repository.ts` (the typed repository contract; see below).
- New file: `apps/web/lib/index/sql-writers.ts` (the SQL implementations of the repository methods).
- Edit: `apps/web/lib/index/market-event.ts` — add `(source, source_event_id, transport)` derivation; do not remove the existing `id` field (legacy in-memory dedup continues to use it for one slice).
- Edit: `apps/web/lib/index/apply-event.ts` — wrap projection writes in a single SQL transaction; persist `market_events` first; gate on `wasMarketEventSeen` only when SQL is unavailable.
- Edit: `apps/web/lib/index/pg.ts` — apply Schema V2.1 DDL additions (below) after `SCHEMA_V2_SQL`; expose `getPool()` for transactional callers; remove the full-rebuild function from any reachable hot path.
- Edit: `apps/web/lib/index/store.ts` — add `market_event_last_event_at` shadow read for the `ListingRecord` so the in-memory reducer can avoid resurrecting older events before the SQL write commits (best-effort guard, not a substitute for SQL).
- Edit: `apps/web/lib/index/worker.ts` — wire `startHotVerify` and `startCollectionEventPoll` to call the new repository methods when SQL is enabled; preserve the in-memory write as the source of the *next* `saveIndex()` blob write.
- New tests under `apps/web/lib/index/*.test.ts` for the six adversarial cases below.
- Edit: `apps/web/lib/index/schema-v2.ts` — extend with the Schema V2.1 additions below.

Out of scope:

- Anything in `apps/web/lib/market/open-sea-source.ts` other than its call sites (Stream/REST normalization lives in `market-event.ts`, not in the source class).
- Web read paths (`apps/web/app`, `apps/web/components`).
- Trading or wallet code.
- `OpenSeaMarketSource` retirement (A7).

---

## Schema V2.1 additions (additive, idempotent)

Append to `SCHEMA_V2_SQL` in `apps/web/lib/index/schema-v2.ts`:

```sql
ALTER TABLE token_market_state
  ADD COLUMN IF NOT EXISTS state_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS state_event_id TEXT,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_verified_by TEXT;  -- 'rest-best-listing' | 'walker' | 'stream-apply' | null

CREATE INDEX IF NOT EXISTS idx_token_market_state_state_event
  ON token_market_state (collection_id, token_id, state_event_at DESC);
```

These columns are nullable so existing rows are not invalidated. Writers fill them on every apply; readers (A4+) can use them as the ordering source for live vs stale.

Existing `token_id` PKs on `tokens` / `token_market_state` / `token_facets` / `token_categories` remain in place. They are scheduled for drop in A5 once all writers have been observed writing through the new repository for at least one staging coverage walk without PK collisions.

---

## Repository contract (`apps/web/lib/index/repository.ts`)

Each method is a typed signature; the implementation lives in `sql-writers.ts`. All methods are collection-scoped (require an explicit `collectionId`), idempotent on `(collection_id, token_id, ...)` natural keys, and intended to be composed inside a single `BEGIN/COMMIT` transaction.

```ts
import type { PoolClient } from 'pg';
import type { MarketEvent } from './market-event';
import type { ListingObservation } from '../market/listing-state';
import type { SaleAttribution } from '../market/engine';

export type ApplyMarketEventInput = {
  collectionId: string;             // resolved from collection registry, not caller string
  event: MarketEvent;               // canonical id is (source, source_event_id)
  tokenPatch?: TokenPatch;          // optional, for 'sold'/'transferred'/'metadata'
  listingPatch?: ListingObservation; // optional, for 'listed'/'cancelled'/'sold'
  salePatch?: SalePatch;            // optional, for 'sold'
  attributionPatch?: SaleAttribution[]; // optional, for 'sold'
};

export type ApplyMarketEventResult =
  | { kind: 'applied'; eventId: number; projectionApplied: boolean }
  | { kind: 'duplicate'; reason: 'seen' }
  | { kind: 'rejected-older'; storedAt: Date; storedSourceEventId: string }
  | { kind: 'rejected-shape'; reason: string };

export interface MarketRepository {
  /** Atomic: insert event + apply projection in one transaction. */
  applyMarketEvent(input: ApplyMarketEventInput): Promise<ApplyMarketEventResult>;

  /** Explicit inserts/upserts — used by reconciliation and admin tools. */
  insertMarketEvent(input: { collectionId: string; source: string; sourceEventId: string; eventType: string; tokenId: number | null; orderHash: string | null; transactionHash: string | null; payload: unknown; occurredAt: Date | null; }): Promise<{ id: number; inserted: boolean }>;
  upsertToken(input: { collectionId: string; tokenId: number; displayNumber: string; exists: boolean; ownerAddress: string | null; name: string | null; imageUrl: string | null; metadataJson: string | null; metadataVerifiedAt: Date | null; lastSeenAt: Date; }): Promise<void>;
  replaceTokenFacetsForToken(input: { collectionId: string; tokenId: number; facets: Array<{ family: string; slug: string; label: string; source: string; sourceVersion: string | null; metadata: unknown | null; }>; }): Promise<void>;
  upsertTokenMarketState(input: { collectionId: string; tokenId: number; state: 'UNKNOWN' | 'LISTED' | 'UNLISTED_VERIFIED' | 'STALE'; bestOrderHash: string | null; bestPriceDecimal: string | null; currency: string | null; seller: string | null; listedAt: Date | null; lastVerifiedAt: Date | null; consecutive404s: number; stateEventAt: Date | null; stateEventId: string | null; lastVerifiedBy: string | null; expectedEvent?: { occurredAt: Date; sourceEventId: string }; }): Promise<{ applied: boolean; reason?: 'older-event' | 'no-fresh-verification' }>;
  insertSale(input: { collectionId: string; saleEventId: string; tokenId: number; price: string; currency: string; occurredAt: Date; orderHash: string | null; buyer: string | null; seller: string | null; marketplace?: string; }): Promise<{ inserted: boolean }>;
  insertSaleAttributions(input: { collectionId: string; rows: SaleAttribution[]; }): Promise<{ inserted: number }>;
  updateWorkerState(input: { workerId: string; lastTickAt: Date; tokensProcessedTotal: bigint; phase: string; lastError: string | null; last429At: Date | null; cursorState: Record<string, unknown>; }): Promise<void>;

  /** Reconciliation entry point — explicit override that requires a fresher verification timestamp. */
  reconcileFromLiveVerification(input: { collectionId: string; tokenId: number; verifiedAt: Date; verifiedBy: 'rest-best-listing' | 'walker'; state: 'LISTED' | 'UNLISTED_VERIFIED'; orderHash: string | null; price: string | null; currency: string | null; seller: string | null; }): Promise<{ applied: boolean; reason?: 'not-fresher' }>;

  /** Transaction helper for callers that compose multiple methods atomically. */
  withTransaction<T>(fn: (client: PoolClient, repo: MarketRepository) => Promise<T>): Promise<T>;
}
```

### Canonical source event identity

`MarketEvent.source_event_id` is the upstream-stable OpenSea event identity:

- For events with an `order_hash`: `source_event_id = order_hash`.
- For events without an `order_hash` but with a transaction: `source_event_id = transaction_hash + ':' + log_index` (extracted from `event.transaction`).
- For metadata-only events (no order, no transaction): `source_event_id = chain_id + ':' + contract_address + ':' + token_id + ':' + occurred_at_iso` (a documented fallback; revisit per ADR 0004 revisit clause).

`MarketEvent.source = 'opensea'` for both Stream and REST events. The transport (`'stream'` vs `'rest'`) is carried as `MarketEvent.transport` and is *not* part of the dedup key. The existing `MarketEvent.source` field is renamed to `MarketEvent.transport` in the type; the SQL `market_events.source` column keeps `'opensea'`. A migration shim keeps both fields populated for one slice to avoid breaking `apply-event.test.ts`.

### Atomic event + projection rule (Invariant 1)

```sql
BEGIN;
  INSERT INTO market_events (..., source, source_event_id, ...) VALUES (...) ON CONFLICT (source, source_event_id) DO NOTHING RETURNING id;
  -- if no row returned: ROLLBACK and return { kind: 'duplicate' }
  -- compute target projection from event payload in app code
  -- call upsertTokenMarketState with expectedEvent so the SQL can reject if older
  UPDATE token_market_state SET ... WHERE collection_id = $1 AND token_id = $2 AND (... newer-event guard ...);
COMMIT;
```

The full event + projection sequence runs inside one `withTransaction`. The `wasMarketEventSeen` in-memory check is **not** the dedup — it is a hot-path short-circuit only when the SQL transaction would be too expensive for an event that is already known. The SQL `ON CONFLICT (source, source_event_id) DO NOTHING` is the only authoritative dedup.

### Out-of-order rejection (Invariant 3)

`upsertTokenMarketState` accepts an optional `expectedEvent = { occurredAt, sourceEventId }`. When provided, the UPDATE runs only when:

```
new_event.occurred_at > stored.state_event_at
OR (new_event.occurred_at = stored.state_event_at AND new_event.source_event_id > stored.state_event_id)
```

`source_event_id` is the deterministic tie-breaker for equal timestamps. If neither condition holds, the UPDATE is skipped and the call returns `{ applied: false, reason: 'older-event' }`. The event row is still in `market_events` for audit; it just does not move state.

### Reconciliation override (Invariant 4)

`reconcileFromLiveVerification` accepts a `verifiedAt` and a `verifiedBy`. The UPDATE runs only when:

```
verifiedAt > stored.state_event_at
```

If the lookup returned a current ask at `verifiedAt`, the row is updated and `last_verified_at = verifiedAt`, `last_verified_by = verifiedBy`, `state_event_at = verifiedAt`, `state_event_id = 'verify:' + verifiedBy + ':' + verifiedAt.toISOString()`. If the lookup is stale, the call returns `{ applied: false, reason: 'not-fresher' }` and writes nothing. There is **no** other override path.

---

## Adversarial test plan

Every test must be **seen red once** before being marked passing (QA-hat rule). All tests run against an in-process pg-mem or a test Postgres; no live database is touched. The worker and the web app are not started during these tests; the repository is exercised directly.

1. **Duplicate Stream + REST event.** Apply a Stream `item_listed` for token 966 with order_hash `0xabc`. Apply a REST `listing` for the same upstream order (same `order_hash, occurred_at, token_id`). Assert: exactly one `market_events` row exists with `(source='opensea', source_event_id='0xabc')`. Assert: `token_market_state` for token 966 has the Stream’s price (first writer wins on tie, since the Stream was applied first).
2. **Cancel followed by delayed older listing.** Apply a `listed` event with `occurred_at = T1`. Apply a `cancelled` event with `occurred_at = T2 > T1`; assert state is `UNLISTED_VERIFIED`. Apply a REST replay `listed` event with `occurred_at = T0 < T1`; assert the call returns `{ kind: 'rejected-older' }` and `token_market_state.listing_state` is still `UNLISTED_VERIFIED` (the cancelled ask was not resurrected).
3. **Sale following listing.** Apply `listed` at T1. Apply `sold` at T2 > T1. Assert: `token_market_state` is `UNLISTED_VERIFIED`, `sales` has one row with the correct `(sale_event_id, token_id, price)`, `sale_attributions` has one row per facet slug for the token, `token_facets` membership was not destroyed.
4. **Replay after restart.** Simulate a worker restart by clearing the in-memory `IndexSnapshot` and the in-memory `wasMarketEventSeen` set, but keeping the SQL state. Re-apply the same events that were applied before the restart. Assert: every event returns `{ kind: 'duplicate' }` from the SQL `ON CONFLICT`. Assert: the projection in SQL is unchanged.
5. **Same token ID in two collections.** Insert a stub collection `gear-test` (do not seed real NetNet Gear — use a placeholder collection row for the test only). Apply a `listed` event for token 68 against the Button Presser collection; apply a `listed` event for token 68 against `gear-test`. Assert: two distinct `token_market_state` rows exist, one per `(collection_id, token_id)`. Assert: token 68 in Button Presser is unaffected by the gear-test apply and vice versa. The test cleanup removes the `gear-test` collection row.
6. **Transaction rollback halfway through an event apply.** Wrap a `withTransaction` block that calls `insertMarketEvent` (which succeeds), then deliberately throws from a subsequent `upsertTokenMarketState` (e.g. violate the `listing_state` CHECK). Assert: `market_events` has no row for this event id (the transaction rolled back). Assert: `token_market_state` for the token is unchanged.

Tests 1, 2, 4, 5, 6 also exercise the canonical identity rule and the atomicity invariant. Test 3 also exercises the sale-attribution path.

A separate non-adversarial test set covers: `upsertToken`, `replaceTokenFacetsForToken`, `insertSale` (idempotent on `sale_event_id`), `insertSaleAttributions` (idempotent on `(sale_event_id, category_slug)`), `updateWorkerState`.

---

## Audit gate (must return PASS/BLOCK before A2 is shippable)

The five audits from the operating manual, applied to A2:

1. **Data Integrity.** Every event reaching the apply path produces exactly one `market_events` row (or an explicit `duplicate`). Projection writes are atomic with the event row. No `DELETE FROM token_*` followed by full rebuild in any reachable code path. `token_id` is never used as a unique key outside of legacy PKs that are flagged for drop in A5.
2. **Cross-Surface Consistency.** The in-memory `IndexSnapshot` (`saveIndex` blob source) and the SQL projection agree on every token affected by an event between `applyMarketEvent` and the next `scheduleSaveSnapshotToPg({normalized: true})` call (which only happens in admin scripts). The agreement is asserted by a new test that exercises the dual-write window and reloads the snapshot from `index_blob`.
3. **Failure Mode.** The 6 adversarial tests all pass. Additional failure tests: 429 from OpenSea mid-apply, Postgres unreachable mid-apply, `applyMarketEvent` throws after `insertMarketEvent` succeeds (rollback asserted), `upsertTokenMarketState` is called with `listing_state` not in the CHECK constraint (rollback asserted).
4. **Migration.** `applyMarketEvent` callers (Stream handler, REST poll, walker reconciliation) all run through the new repository. The legacy `upsertNormalized` function is reachable only through a function named `adminRebuildNormalized` that requires an explicit `MARKET_ADMIN_REBUILD=1` env flag and logs an audit line. The legacy `ON CONFLICT (token_id)` upserts in `pg.ts` are wrapped in a code comment marking them as A5 technical debt.
5. **Release Readiness.** Staging applies Schema V2.1 (idempotent), runs the worker through one full coverage walk with the new writers, and the staging `applyMarketEvent` calls return `applied` for new events and `duplicate` for replays. No production deploy of A2 writers happens until staging has done so without a 429 storm for 60 minutes.

A2 is shippable when all five audits return **PASS**. Any **BLOCK** rolls the slice back; nothing is merged to `main`.

---

## What A2 does NOT do (explicit carry-over)

- It does **not** switch any web read path to `market_events` or to `token_market_state`. The web still loads `index_blob` and uses `TokenCatalog` (ADR 0004 §Decision — A4–A6).
- It does **not** introduce `MARKET_READ_MODEL=sql` flag handling. The flag exists but stays at `blob` everywhere until A5.
- It does **not** add a shadow parity verifier (A3). A3 will read the rows A2 writes.
- It does **not** drop the `token_id` PKs. The collection-aware code is in place so A5 can drop them as a no-op migration.
- It does **not** change the Stream or REST transport. `stream-ingest.ts` and `event-poll.ts` continue to parse OpenSea payloads; only the downstream `applyMarketEvent` is rewritten.

---

## Staging CI readiness (carried from A1 verdict)

The CI workflow (`.github/workflows/ci.yml`) only triggers on `push` to `main`. The staging branch HEAD was reached by `gh pr merge --squash` and has no independent CI run. **Before A2 lands on staging, extend the CI push trigger to also include `staging`**:

```yaml
on:
  push:
    branches: [main, staging]
  pull_request:
```

This is a one-line change in a single file and is part of the A2 PR.

---

## Out-of-band open question

Per the founder’s A1 verdict: **branch protection** on `main` and `staging` (PR required, CI required, no direct pushes) is still required before A4/A5. That is a separate GitHub settings task and is not in A2.