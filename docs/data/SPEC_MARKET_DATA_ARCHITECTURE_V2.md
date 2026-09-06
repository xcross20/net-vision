# SPEC: Market Data Architecture V2 (A1)

**Status:** Accepted for A1 only  
**Date:** 2026-09-06  
**Class:** architecture (one-way door)  
**Hats:** PM → Architect → Staff → Implementer → QA → Reviewer → SRE → Tech Lead

This spec is the bounded system-delivery objective. It is **not** a rewrite ticket.

## Problem

Operators and the product cannot treat Postgres as the market truth because request-path answers still require deserializing a 62k-token `IndexSnapshot` blob into a process-local `TokenCatalog`. That cost grows with every collection, sale, and category surface, and it makes homepage / categories / listings coherence a rehydration problem instead of a query problem. NetNet Gear cannot land on a schema where `token_id` is globally unique.

## Objective (this program)

Promote normalized Postgres tables from recovery/dual-write storage to the authoritative operational market model, while retaining the `IndexSnapshot` blob as a recovery/checkpoint and shadow-comparison artifact. **No user-visible behavior change.**

## Semantic owners (unchanged)

| Fact | Authority during and after migration |
| --- | --- |
| `collection.totalSupply` | Plate `officialExistingSupply` on the `collections` row |
| `collection.listedVerified` | `token_market_state.listing_state = LISTED` only |
| `collection.floor` | MIN LISTED `best_price_decimal` in that collection |
| `category.listedVerified` | LISTED rows joined to canonical `token_facets` |
| Listing states | `UNKNOWN \| LISTED \| UNLISTED_VERIFIED \| STALE` |
| Wallet execution | Decoded calldata + policy (untouched) |

`token_facets` is canonical membership. `token_categories` is a derived/materialized lookup and must be rebuildable from facets. Two independent membership truths are a P0 sibling-risk.

## Acceptance claims (program)

1. A listing event for one token can be persisted as a single-row mutation; the worker does not serialize the other ~62k tokens to apply that event. *(A2 — not this slice)*
2. Collection, Brass, Steel, 3 Digit, Palindromes, and Repeating listed-count and floor from SQL match the blob catalog at the same `snapshotRevision` before SQL becomes the request path. *(A3)*
3. Homepage, `/categories`, `/categories/[slug]`, listings API `total`, and tab count can be served from SQL for one collection without loading `index_blob.payload`. *(A4–A5)*
4. `MARKET_READ_MODEL=blob` remains the production default until staging parity + Release Readiness PASS. *(A4–A6)*
5. Token identity is `(collection_id, token_id)`. Button Presser #68 and a future NetNet Gear #68 cannot collide. *(A1 expand; PK contract in A2)*
6. User-visible listing-state semantics, wallet/trading security, and coverage threshold (`live` requires ≥ 0.95) do not change.

## Acceptance claims (A1 only — this slice)

1. `ecosystems` and `collections` tables exist and are seeded with Helix + Button Presser using `chain-config` as the source of official supply, chain id, contract, and slug.
2. Every token-scoped table has `collection_id` (NOT NULL, default Button Presser) and a unique index on the collection-scoped natural key.
3. `market_events` exists with `UNIQUE (source, source_event_id)` so A2 can persist events idempotently.
4. Schema comments (and a code-level constant) declare `token_facets` canonical and `token_categories` derived.
5. `listing_state` is constrained to the four legal states.
6. `index_blob` is not dropped, truncated, or removed from the dual-write path.
7. Existing blob writers (`ON CONFLICT (token_id)`, `scheduleSaveSnapshotToPg` blob-only) still succeed after A1 is applied — old PKs remain until A2 updates writers.
8. No request-path, UI, trading, or OpenSea ingest behavior changes.
9. Applying A1 SQL is idempotent (`IF NOT EXISTS` / `ON CONFLICT`).

## Non-goals (this slice and this program)

- Visual rebuild, NetNet Gear UI, My Gameplan, protocols, Quotrons, Robinhood Vision.
- Kafka, Redis, Elasticsearch, ClickHouse, GraphQL, microservices, CQRS/event-sourcing frameworks.
- Switching production reads to SQL.
- Removing `OpenSeaMarketSource` (A7).
- Dropping `token_id` primary keys (blocked until A2 writers are collection-aware).
- PR preview environments (later).
- Changing listing-state meanings or coverage math.

## Slices

| ID | Slice | Shippable claim |
| --- | --- | --- |
| A1 | Schema V2 | Identity + events tables exist; production request path unchanged |
| A2 | Incremental SQL writer | Event-local upserts; blob still written in parallel |
| A3 | Shadow parity verifier | Blob vs SQL for collection + five named categories |
| A4 | SQL read model + `MARKET_READ_MODEL` | Flagged reads; production stays `blob` |
| A5 | Staging cutover | Staging `MARKET_READ_MODEL=sql` + Release Readiness |
| A6 | Production cutover | Production reads SQL; blob is checkpoint |
| A7 | Legacy read-path retirement | No request-path catalog hydration |

**This change implements A1 only.**

## Door class

**One-way.** Persisted schema, natural keys, and event identity will have unseen consumers (A2 writers, A4 readers, future collections). Wrong keys are a data migration, not a refactor.

## Riskiest unknown

Whether existing production rows can take a `listing_state` CHECK and `collection_id` DEFAULT without locking or constraint failure while the worker is scanning. Mitigation: additive DDL only; do not merge A1 to `main` until staging applies it; do not drop old PKs in A1.

## Scope guard (audit 14)

In: schema + identity constants + tests + ADRs + staging environment (separate spec).  
Out: A2–A7 code, UI, new collections as product, infra beyond Postgres.
