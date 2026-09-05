# Market Indexer V2 — Architecture

Status: **Specified (PR 1 of 2).** This is the design that replaces the current single-200-page OpenSea ingest. Implementation lands in subsequent PRs. See `../MARKET_INDEXER_V2_PLAN.md` (session plan) for the phased rollout and acceptance criteria.

## Problem statement

Net Vision currently reads the Button Presser orderbook by fetching a single page of 200 orders from OpenSea and treating that page as the complete marketplace. As a result:

- `/categories/digits-3` reports 900 members and 0 listings while OpenSea's `Presser: 100–999` filter shows roughly 104 active listings.
- Every category market metric that depends on listings is unreliable. Floors are wrong. Counts are wrong. The "not listed" badge is wrong because unscanned tokens are silently labelled unlisted.
- The production token universe is assumed to be the closed range `1..62095`, which is neither verified nor hole-safe.

The fix is to replace the in-memory `TokenCatalog` with three independent authoritative layers, each persisted, each with its own source of truth, joined at query time.

## Three independent authoritative layers

| Layer | Question | Source of truth |
| --- | --- | --- |
| **Token Registry** | What Button Presser NFTs actually exist? | OpenSea `/api/v2/collection/{slug}/nfts` enumeration + onchain `totalSupply()` sanity check |
| **Taxonomy Membership** | Which deterministic Net Vision categories does each existing NFT belong to? | `@net-vision/taxonomy` (pure, deterministic, versioned) |
| **Marketplace State** | Which existing NFTs are currently listed, offered, sold, or transferred? | Background worker using OpenSea `getBestListing` + `getCollectionEvents` |

No layer derives its truth from another. All three are persisted.

## Schema

```text
tokens
──────────────────────────────
token_id            INTEGER PRIMARY KEY
display_number      INTEGER NOT NULL UNIQUE   -- if number identity holds (see BUTTON_NUMBER_IDENTITY.md)
exists              BOOLEAN NOT NULL
owner_address       TEXT
name                TEXT
image_url           TEXT
metadata_json       TEXT
metadata_verified_at TIMESTAMP
registry_source     TEXT                       -- 'opensea-nft-enumeration' | 'onchain-spotcheck'
registered_at       TIMESTAMP NOT NULL
last_seen_at        TIMESTAMP NOT NULL


token_categories
──────────────────────────────
token_id          INTEGER NOT NULL REFERENCES tokens(token_id)
category_slug     TEXT NOT NULL
taxonomy_version  TEXT NOT NULL
classified_at     TIMESTAMP NOT NULL
PRIMARY KEY (token_id, category_slug)


market_listings
──────────────────────────────
marketplace        TEXT NOT NULL          -- 'opensea'
order_hash         TEXT NOT NULL PRIMARY KEY
token_id           INTEGER NOT NULL REFERENCES tokens(token_id)
seller             TEXT NOT NULL
price_raw          TEXT NOT NULL           -- raw decimal string from OpenSea
price_decimal      NUMERIC NOT NULL
currency           TEXT NOT NULL
start_time         TIMESTAMP
end_time           TIMESTAMP
status             TEXT NOT NULL           -- 'active' | 'cancelled' | 'filled' | 'expired'
discovered_at      TIMESTAMP NOT NULL
verified_at        TIMESTAMP NOT NULL


token_market_state
──────────────────────────────
token_id           INTEGER PRIMARY KEY REFERENCES tokens(token_id)
listing_state      TEXT NOT NULL           -- UNKNOWN | LISTED | UNLISTED_VERIFIED | STALE
best_order_hash    TEXT REFERENCES market_listings(order_hash)
best_price_decimal NUMERIC
currency           TEXT
last_verified_at   TIMESTAMP
consecutive_404s   INTEGER NOT NULL DEFAULT 0


market_events
──────────────────────────────
marketplace_event_id TEXT PRIMARY KEY
token_id             INTEGER NOT NULL REFERENCES tokens(token_id)
type                 TEXT NOT NULL    -- 'listing_created' | 'listing_cancelled' | 'sale' | 'transfer' | 'offer_created'
order_hash           TEXT
price_decimal        NUMERIC
wallets              JSONB
occurred_at          TIMESTAMP NOT NULL
ingested_at          TIMESTAMP NOT NULL


category_market_stats
──────────────────────────────
category_slug        TEXT PRIMARY KEY
member_count         INTEGER NOT NULL
verified_count       INTEGER NOT NULL
listed_count         INTEGER NOT NULL
unknown_count        INTEGER NOT NULL
floor_price_decimal  NUMERIC
highest_ask_decimal  NUMERIC
currency             TEXT
updated_at           TIMESTAMP NOT NULL


worker_state
──────────────────────────────
worker_id            TEXT PRIMARY KEY
last_tick_at         TIMESTAMP NOT NULL
tokens_processed_total BIGINT NOT NULL DEFAULT 0
phase                TEXT NOT NULL           -- 'bootstrap' | 'hot-refresh' | 'unknown-sweep'
last_error           TEXT
cursor_state         TEXT                    -- JSON blob for resumable progress


oracle_runs
──────────────────────────────
run_id              TEXT PRIMARY KEY
started_at          TIMESTAMP NOT NULL
finished_at         TIMESTAMP
categories_json     TEXT NOT NULL            -- [{category, netVisionCount, openSeaCount, delta}]
```

## Listing state machine

`token_market_state.listing_state` transitions deterministically. The current binary `notListedIds()` semantic is removed — it conflated "not known listed" with "not listed", which was the root cause of `/categories/digits-3` showing zero listings.

```text
UNKNOWN
  │
  │  getBestListing returns a real order
  ▼
LISTED ────────► (market_listings.status = expired  OR  end_time < now())
  ▲                       │
  │                       ▼
  │                     STALE
  │                       │
  │                       │  next verification confirms new order
  │                       ▼
  └───────────────── LISTED
                          │
                          │  getBestListing returns 404 (n times in 24h)
                          ▼
                    UNLISTED_VERIFIED ───► (last_verified_at older than TTL)
                          │                      │
                          │                      ▼
                          │                    STALE
                          │                      │
                          │                      │  next verification confirms new order
                          │                      ▼
                          └────────────────► LISTED
```

Defaults:

- 404-streak threshold to enter `UNLISTED_VERIFIED`: 2 consecutive 404s within 24h.
- TTL for `UNLISTED_VERIFIED` → `STALE`: 24h.
- TTL for `LISTED` → `STALE` on `end_time < now()`: enforced at every read.

## Worker lifecycle

Single-replica Railway service. Three phases looped with sleeps.

```text
PHASE A — Bootstrap (resumable; runs first or until all tokens covered)
  for every tokens row where exists = true AND token_market_state.last_verified_at IS NULL:
      getBestListing(token_id)
      upsert token_market_state + market_listings
      rate-limited queue pacing

PHASE B — Hot refresh (every 5 min)
  for every token_market_state where listing_state IN ('LISTED', 'STALE'):
      getBestListing(token_id)
      upsert

PHASE C — Unknown sweep (every 30 min)
  for every token_market_state where listing_state = 'UNKNOWN'
  ORDER BY last_verified_at ASC NULLS FIRST
  LIMIT batch_size:
      getBestListing(token_id)
      upsert

ALSO — recategorise category_market_stats:
  recompute for each category_slug after each phase.
```

Throughput estimates (no retry, no 429):

- 2 tokens/sec ≈ 8.6h full bootstrap on a 62,093-token collection.
- 5 tokens/sec ≈ 3.5h.

The current `OpenSeaMarketSource.ensurePipeline` and visible-confirm scan remain as a **fallback** while the worker boots. Once the worker reports `coverage_percent >= 0.95` via `/api/v1/health/coverage`, the fallback is removed.

## Coverage semantics

`category_market_stats.coverage_percent = verified_count / member_count`. The UI surfaces this directly:

- `coverage_percent < 0.95` → render **`Syncing market data`** with `verified_count / member_count`. Do **not** display `floor` or `listed_count` as authoritative.
- `coverage_percent >= 0.95` → render **`Live`** with full metrics.

This kills the silent zero floor bug. While the worker is still discovering listings, the UI cannot show `0 listings` — it must show `Syncing market data` until the underlying truth is verified.

## Onchain enumeration without a third-party indexer

We do not have Blockscout credentials. OpenSea's NFT enumeration endpoint is the primary source for the token registry. We add two safety nets:

1. **Supply cross-check.** Call the contract's `totalSupply()` via viem on every worker tick (cheap; one RPC). If `totalSupply() != COUNT(*) WHERE exists = true`, raise a worker error and stop indexing until reconciled.
2. **Random spot-check.** On every bootstrap pass, fetch three random token IDs via viem `ownerOf(tokenId)` and compare the address to `tokens.owner_address`. If any divergence, raise an alert.

`tokenByIndex` walk is out of scope. Documented under "What we are not doing" below.

## Risks (ranked)

1. **OpenSea enumeration gaps.** The NFT enumeration endpoint can paginate, but OpenSea has been observed to truncate or rate-limit. Mitigation: cursor diagnostic (PR 2 Phase 6) plus the supply cross-check above.
2. **Worker 429 cascade.** Already bit us once. Mitigation: `isOpenSeaRateLimited` cooldown, exponential backoff with jitter, bounded concurrency, **never** invoked from a request handler.
3. **`UNKNOWN` leaking into UI as `unlisted`.** Same bug as today under a renamed function. Mitigation: CI grep guard that fails the build if any module imports the removed `notListedIds()` helper.
4. **Number identity drift.** If a future token is minted with a non-sequential identifier, taxonomy joins break silently. Mitigation: a checked-in number-identity fixture plus a nightly probe that fails CI if the invariant breaks.
5. **Schema migration on Railway.** If the chosen storage is Postgres and the volume is zero before this lands, the worker cannot boot. Mitigation: migrations are idempotent and gated behind `INDEXER_V2_ENABLED`; the in-memory `TokenCatalog` remains the fallback until the migration succeeds.
6. **Token display changes.** If the contract later changes `name` or `image`, cached `tokens.name` / `tokens.image_url` go stale. Mitigation: 7-day TTL on cached display fields, refreshed on the next worker pass.

## What we are not doing (yet)

- ERC-721 `tokenByIndex` enumeration. Without Blockscout this is expensive. OpenSea + `totalSupply()` cross-check is enough for v2.
- Real-time websocket / SSE feed. Polling is fine for v2.
- Multi-collection support. Schema is generic; the worker only handles Button Presser this PR.
- Per-user portfolio valuation, category bids, category offers aggregation. These stay frozen until coverage reconciles.

## Definition of done

The rebuild ships when **all** of the following are true:

1. `tokens` table exists; `COUNT(*) WHERE exists = true` matches OpenSea's reported supply (±1) and contract `totalSupply()`.
2. `token_categories` is populated for every deterministic category; `category_market_stats` is populated.
3. `token_market_state` uses the 4-state model. `notListedIds()` is gone. A CI grep guard enforces this.
4. Worker reports `coverage_percent >= 0.95` on every deterministic category. Worker heartbeat within 60s.
5. `/categories/digits-3` reports `900 members`, a non-zero listed count that converges with OpenSea's `Presser: 100–999` count within ±2, and a floor that matches the cheapest verified listing in that range.
6. Specific tokens (`#966, #628, #870, #507, #756, #635`) appear with matching prices/currencies to OpenSea.
7. `/admin/reconcile` shows Δ ≤ 2 for at least 5 categories.
8. The integrity suite in `tests/integrity/category-integrity.test.ts` is green in CI.

Until all eight are true, commerce features (Category Sweep, Value Sweep, alerts, market radar, category bids) stay feature-flagged.

## Storage decision

**Authoritative store (ADR 0002):** PostgreSQL when `DATABASE_URL` is set. JSON on disk (`INDEX_DB_PATH`, default `apps/web/data/market-index.json`) is a local/dev cache and dual-write companion only.

**Worker runtime (ADR 0002):** standalone `apps/market-worker` Railway service. Starts on process boot — not on `OpenSeaMarketSource` construction. Web process must not embed the indexer in production (`INDEXER_EMBEDDED` unset/false). See `docs/data/SPEC_ALWAYS_ON_INDEXER.md` and `docs/deploy/RAILWAY_MARKET_WORKER.md`.

## Phase rollout

| Phase | Deliverable | Depends on |
| --- | --- | --- |
| 0 | This document | — |
| 1 | `docs/data/BUTTON_NUMBER_IDENTITY.md` + fixture + unit test | Phase 0 |
| 2 | Persistent Token Registry + cross-check | Phase 1 |
| 3 | Persistent Taxonomy Membership migration | Phase 2 |
| 4 | 4-state Marketplace State model | Phase 2 |
| 5 | Listing reconciliation worker | Phases 2, 3, 4 |
| 6 | OpenSea cursor diagnostic | — |
| 7 | Coverage-aware category queries + UI | Phases 3, 4, 5 |
| 8 | `/admin/reconcile` oracle | Phase 5 |
| 9 | 3 Digit acceptance test | Phase 7 |
| 10 | Category integrity suite | Phase 4 |
| 11 | Migration of source of truth | Phases 7, 10 |
| 12 | Feature freeze enforcement | Phase 9 |