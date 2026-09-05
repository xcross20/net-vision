# Market Indexer V3 — Realtime foundation

Status: **In progress (PR A).** Builds on Category Market V2 + Indexer V2.
SSE / browser live push is **PR B** and out of scope here.

## Problem

Indexer V2 correctly introduced 4-state listings, Plate metadata bootstrap, and a
JSON→Postgres bridge, but live truth still depends on an in-process poller inside
Next.js (~500ms/token). Redeploying web pauses indexing. OpenSea Stream is unused.

## Goal

| Signal | Target |
| --- | --- |
| Event ingest (Stream → Postgres) | &lt; 5s |
| Category UI convergence | &lt; 10s |
| Acceptance categories | Brass, 3 Digit, Steel, Palindromes, Repeating |
| Real-money Category Sweep | Still gated |

## Authority rule

```text
Postgres          = authority
JSON volume file  = optional cache / backup only
TokenCatalog      = derived request-path cache only
```

Web must **not** start `startBackgroundIndexer` in production once the worker service is live.

## Architecture

```text
OpenSea Stream (button-presser)  ──┐
REST gap backfill on reconnect   ──┼──► apps/market-worker ──► Postgres
Hot reconcile (floors/cart/STALE)──┤         │
Cold auditor (slow full scan)    ──┘         │
                                             ▼
                                      apps/web (read)
```

## Event model

Idempotent `market_events` rows:

```text
marketplace_event_id  TEXT PRIMARY KEY
  = event_type + ':' + (order_hash|tx) + ':' + token_id + ':' + event_timestamp
```

Stream handlers (or REST poll fallback) insert-first; state transitions apply only
when the insert wins or the payload is newer than `token_market_state.last_verified_at`.

OpenSea documents Stream as **best-effort** — reconnect **must** backfill via
`getCollectionEvents` from `last_event_at - 2min`.

## Robinhood Stream spike

**Result (2026-09-05):** Stream is **live for `button-presser` on `chain: robinhood`.**

45s listen received **282** events:

| Type | Count |
| --- | --- |
| `item_received_bid` | 239 |
| `order_invalidate` | 32 |
| `item_cancelled` | 11 |

Payloads include `nft_id` like `robinhood/0xe514…/635`. **Recommendation: stream-primary** (REST poll remains gap-fill on reconnect).

Reproduce: `OPENSEA_API_KEY=… npm run spike:stream`

## Worker service

`apps/market-worker` — single Railway replica, Node 22+, advisory lock on boot.

Responsibilities:

1. Stream (or REST-events) apply loop  
2. Hot reconcile acceptance floors + priority tokens  
3. Cold auditor (slow) + Plate metadata bootstrap continuation  
4. Heartbeat into `worker_state`

## Web cutover

1. `INDEX_AUTHORITY=postgres` — hydrate catalog from normalized tables  
2. `INDEXER_IN_WEB=false` — constructor must not start background loops  
3. Short TTL / generation counter for category cache invalidation  

## Acceptance (PR A)

1. Web serves floors/listings with Postgres authority and no in-process indexer.  
2. `market-worker` Online; heartbeat &lt; 60s.  
3. Manual listing test converges on `/categories/digits-3` in &lt; 10s (document Stream vs REST).  
4. Idempotent replay does not duplicate sales.  
5. Reconnect backfill fills a 60s gap.  
6. Brass never LIVE on empty membership; bootstrap continues in worker.  
7. CI green: typecheck + test + build.  
8. Sweep remains gated.

## Explicitly deferred (PR B)

- Browser SSE / live category badges  
- Client cart/floor hot verify over push  
- Unlocking Sweep for real money  
