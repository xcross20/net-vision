# SPEC: Market Data Architecture V2 — A2 Incremental SQL Writer

**Status:** Accepted for A2 only  
**Date:** 2026-09-07  
**Class:** architecture (one-way door)  
**Depends on:** A1 Schema V2 (`SPEC_MARKET_DATA_ARCHITECTURE_V2.md`)  
**Does not include:** A3 shadow parity (authorize separately)

## Problem

A1 gave every token-scoped table a `collection_id` and created `market_events`. Writers still treat normalized Postgres as a recovery projection: the hot path dual-writes the `index_blob`, and the only normalized path is a snapshot-wide upsert that `DELETE`s `token_facets` / `token_categories` / `floor_history`. One listing event still cannot mutate one row.

## Objective

Replace snapshot-wide normalized rebuilds with **event-local, collection-scoped, idempotent SQL mutations**.

```
OpenSea Stream / REST / Reconciliation
                ↓
        canonical event
                ↓
        BEGIN transaction
                ↓
       insert market_event
                ↓
      project affected rows
                ↓
             COMMIT
```

The blob remains for checkpoint, recovery, shadow comparison, and the A3 parity oracle.

**No user-visible behavior change. No SQL reads on the request path.**

## Non-goals

- Switch UI / API reads to SQL
- Remove `TokenCatalog` or `index_blob`
- NetNet Gear product, visual rebuild, Redis/Kafka
- Wallet execution changes
- A3 parity verifier
- Starting the staging `market-worker` (ops decision, not this slice)

## Semantic owners (unchanged)

| Fact | Authority |
| --- | --- |
| Token identity | `(collection_id, token_id)` |
| Event identity | `market_events UNIQUE (source, source_event_id)` with `source = opensea` |
| Listing states | `UNKNOWN \| LISTED \| UNLISTED_VERIFIED \| STALE` |
| Category membership | `token_facets` canonical; `token_categories` derived |
| Request-path market facts | Blob / `TokenCatalog` until A4 |

Transport (`stream` \| `rest`) is an attribute, not an identity. It must not defeat dedupe.

## Acceptance claims

1. Applying one listing/cancel/sale mutates that token’s SQL rows only — no full-table `DELETE` on the hot path.
2. The same OpenSea event via Stream, REST, retry, or worker restart inserts one `market_events` row and projects once.
3. Event journal insert and projection commit in one transaction. Duplicate insert is a no-op. Mid-transaction failure rolls back both.
4. An event with `occurred_at` older than `token_market_state.state_event_at` cannot resurrect prior listing state.
5. Cancel of order A does not clear a newer order B.
6. A fresh reconciliation observation may override event-derived state; an older reconciliation may not override a newer event (`verified_at` vs `state_event_at`).
7. Button Presser #68 and a second collection’s #68 coexist.
8. `token_id` primary keys are **not** dropped (Gear is not seeded). Incremental writers use `ON CONFLICT (collection_id, token_id)`.
9. Blob dual-write and request-path reads are unchanged.

## Invariants

1. Every mutation is scoped by `(collection_id, token_id)`.
2. Canonical event id: `source = opensea`, `source_event_id` independent of transport.
3. `BEGIN` → insert event `ON CONFLICT DO NOTHING` → if inserted, project → `COMMIT`.
4. `token_market_state` stores `state_event_at`, `state_event_id`, `state_source`.
5. Reconciliation override only when `verified_at >= state_event_at` (or no event has been applied).
6. Four listing states are unchanged; `applyObservation` remains the state machine.
7. Facet writes are token-local. `token_categories` is rebuilt from that token’s facets only.
8. Legacy snapshot normalized rebuild (full-table `DELETE`) is admin-only: `MARKET_SQL_REBUILD_DESTRUCTIVE=1`.

## Repository surface

`MarketRepository`:

- `insertMarketEvent`
- `getTokenMarketState` (row lock in a transaction)
- `upsertToken`
- `replaceTokenFacetsForToken`
- `upsertTokenMarketState`
- `insertSale` / `insertSaleAttributions`
- `updateWorkerState`
- `withTransaction`

Higher-level:

- `applyCanonicalMarketEvent` — ingest journal + projection
- `applyReconciliationObservation` — walker / hot-verify / orderbook confirm

Worker code must not contain ad-hoc SQL fragments.

## Event projections

| Type | Projection |
| --- | --- |
| `LISTED` | `ask` observation → `LISTED`; set order/price/seller/`state_event_*` |
| `CANCELLED` / `ORDER_INVALIDATED` | `cancel` observation; unmatched order hash is a no-op on state |
| `SOLD` | insert sale + attributions; `cancel` matching listing; owner upsert if present |
| `TRANSFERRED` | owner upsert only (listing invalidation comes from cancel/sold) |
| `METADATA_UPDATED` | token upsert + `replaceTokenFacetsForToken` |
| `ORDER_REVALIDATED` | treated as `LISTED` when price is present |

## Observability

Process counters on indexer health: insert rate, duplicate rate, projection latency p50/p95, projection failures, out-of-order ignored, reconciliation overrides.

## Adversarial tests (required)

1. Same listing twice → one event, one projection
2. Stream + REST same order hash → one canonical event
3. LIST → CANCEL → delayed old LIST → unlisted remains
4. LIST A → CANCEL A → LIST B → LIST B
5. LIST A → LIST B → late CANCEL A → LIST B remains
6. LIST A → SALE A → sale persisted, listing not executable
7. Apply, “restart”, replay → state unchanged
8. Throw after event insert, before projection → empty journal and state
9. `button-presser` #68 and `netnet-gear` #68 coexist
10. Concurrent same event → one winner, one no-op

## Completion gate

```
A2 PASS =
  adversarial suite green
  AND incremental writers are the only hot-path SQL mutations
  AND destructive full-table DELETE is gated off
  AND health exposes SQL writer metrics
  AND blob/UI request path unchanged
  AND A3 code is absent
```

Live OpenSea ingest on staging requires the staging worker, which stays off in this slice. Residual: SQL journal fills when the worker is enabled.

## Door class

**One-way** for event identity (`source=opensea` + canonical `source_event_id`) and ordering columns. Wrong identity is a data migration.

## Scope guard (audit 14)

In: schema v2.1 columns, repository, event-local projection, dual-write from existing ingest/recon, tests, health counters, docs.  
Out: SQL reads, parity verifier, Gear product, production `main`, staging worker start.
