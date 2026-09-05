# DESIGN: Always-on market indexer

**Status:** Architect hat — ready for Staff  
**Consumes:** `docs/data/SPEC_ALWAYS_ON_INDEXER.md`  
**Supersedes (partial):** MARKET_INDEXER_V2.md “Worker runtime (v1): same Node process as the web app” and ADR 0001 §1 “Background workers… only when…” — indexing load has made a separate service operationally necessary.

## Data model

### Entities (authoritative in Postgres)

| Entity | Cardinality | Lifecycle |
| --- | --- | --- |
| `tokens` | 1 row per token_id in `1..maxTokenId` once discovered | created on registry/metadata observe; `metadata_verified_at` set on FOUND/MISSING settle; never deleted (soft `exists=false` only) |
| `token_facets` / `token_categories` | N per token | rewritten when metadata settles; taxonomy_version stamped |
| `token_market_state` | 0..1 per token | UNKNOWN → LISTED / UNLISTED_VERIFIED / STALE per listing-state machine |
| `market_events` (new, slice 4) | append-only | one row per ingested Stream/reconcile event; idempotent on `(marketplace_event_id)` |
| `worker_state` | 1 row per `worker_id` | heartbeat + cursors + phase; updated every tick / 15s heartbeat |
| `metadata_retry_queue` (new) | 0..N pending retries | enqueue on RETRY; dequeue when `next_attempt_at <= now`; drop after max attempts → MISSING or `failed` with reason |
| `index_blob` | optional cache | **not** authoritative after cutover; may lag for debug export |

### Worker state payload (`worker_state.cursor_state` JSONB + columns)

```text
worker_id                 TEXT PK   -- 'market-worker'
worker_started_at         TIMESTAMPTZ
worker_heartbeat_at       TIMESTAMPTZ
listing_cursor            INT
listing_processed_total   BIGINT
listing_phase             TEXT
metadata_cursor           INT
metadata_processed_total  BIGINT
metadata_phase            TEXT      -- brass-priority | full | done
metadata_missing_total    BIGINT
last_success_listing_at   TIMESTAMPTZ
last_success_metadata_at  TIMESTAMPTZ
last_error                TEXT
last_429_at               TIMESTAMPTZ
retries_queued            INT       -- denormalized count
```

### Retry queue row

```text
token_id          INT PK (or PK with attempt batch)
attempt_count     INT
next_attempt_at   TIMESTAMPTZ
last_error        TEXT
enqueued_at       TIMESTAMPTZ
```

Backoff schedule (fixed): 10s → 30s → 2m → 10m → 30m; after final failure record MISSING-or-failed observation and advance past the hole with an explicit error note (not silent skip).

### Limiting cases

- **Zero tokens:** health reports cursors 0, Brass 0/999, worker online if heartbeat fresh.
- **Duplicate natural keys:** token_id is sole key; Stream events upsert by token_id + order_hash.
- **Restart mid-Brass:** restore `metadata_cursor` + retry queue from Postgres; do not rebuild from empty JSON.
- **Empty local disk after redeploy:** Postgres restore is mandatory when `DATABASE_URL` set; JSON only if PG empty *and* local file has data (dev).

## Seams (graded)

| Seam | Own truth? | Testable alone? | Replaceable? | Grade |
| --- | --- | --- | --- | --- |
| **Market worker process** (`apps/market-worker`) | Owns write path + heartbeat | Yes — boot script + fake OpenSea | Yes — any Node entrypoint | **Pass** |
| **Index repository** (read/write API over Postgres; JSON fallback) | Owns persistence contract | Yes — unit tests with fake pool / temp JSON | Yes — swap engine behind interface | **Pass** |
| **Listing reconciler** | Owns listing observations → state machine | Yes — inject `BestListingLookup` | Yes | **Pass** |
| **Metadata bootstrap + retry queue** | Owns facet discovery order + RETRY semantics | Yes — inject `MetadataFetch` | Yes | **Pass** |
| **Indexer health HTTP** | Owns operational truth surface | Yes — fixture worker_state | Yes | **Pass** |
| **Web MarketSource (read)** | Must **not** own indexer start | Yes — read-only against repo | Yes | **Pass** if startBackgroundIndexer removed from constructor |
| **OpenSea REST client** | External | Existing package tests | Yes | **Pass** |
| **OpenSea Stream ingest** (slice 4) | External best-effort | Spike first | Yes (fallback = slow reconcile) | **Conditional** — ADR 0003 |

Failing-on-purpose: web process may retain a **disabled-by-default** embedded loop only behind `INDEXER_EMBEDDED=true` for local single-process debug. Production Railway web must not set it.

## Topology

```text
OPENSEA REST                    OPENSEA STREAM (slice 4)
     │                                │
     ▼                                ▼
┌─────────────────────────────────────────────┐
│  net-vision-market-worker (always on)       │
│  - boot → ensureSchema → restore state      │
│  - heartbeat 15s                            │
│  - metadata loop (non-blocking retries)     │
│  - listing loop (bootstrap → hot refresh)   │
│  - stream listeners (after Brass gate opt.) │
│  - slow full reconcile (drift only)         │
└──────────────────┬──────────────────────────┘
                   ▼
              POSTGRES
                   ▲
                   │ read
┌──────────────────┴──────────────────────────┐
│  net-vision-web (Next.js)                   │
│  - serves UI + /api/v1/health/indexer       │
│  - does NOT start indexer loops             │
└─────────────────────────────────────────────┘
```

Railway: three resources — web service, market-worker service, Postgres plugin. Worker `startCommand` runs on boot with no HTTP dependency. Worker may expose a tiny localhost health for Railway if required; authoritative operator health remains on web reading Postgres.

## Decisions

| Decision | Door | Choice | Why |
| --- | --- | --- | --- |
| Separate Railway worker vs keep embedded | **One-way** | Separate `apps/market-worker` | Spec claims 1–2; embedded fails zero-traffic / cold-boot | ADR 0002 |
| Postgres vs JSON authority | **One-way** | Postgres authoritative when `DATABASE_URL` set | Spec claim 6; redeploy empties ephemeral disk | ADR 0002 |
| RETRY head-of-line vs retry queue | Two-way | Retry queue + continue | Spec claim 4; reversible in worker code |
| Heartbeat interval 15s / unhealthy >60s | Two-way | As specified | Matches acceptance claim 5 |
| Stream now vs after bootstrap health | **One-way** for product freshness | Stream in slice 4 after Brass+worker proven; spike Stream on Button Presser slug first | Spec claim 7 + riskiest unknown | ADR 0003 |
| Where health route lives | Two-way | Web `/api/v1/health/indexer` reads Postgres | Operators already hit web; no second public surface required |
| Shared code location | Two-way | Extract worker+store modules usable from `apps/market-worker` via tsx/tsconfig paths or thin `packages/market-index` | Avoid duplicating state machine |

## Pre-empt hotspots

| Concern | Behavior |
| --- | --- |
| OpenSea REST timeout | Client timeout already; on failure → RETRY enqueue, do not block cursor |
| OpenSea 429 | Record `last_429_at`; sleep worker-local cooldown; do not mark token MISSING |
| Stream disconnect | Best-effort; reconnect with backoff; missed events recovered by slow reconciler |
| Duplicate Stream events | Upsert by order_hash / event id |
| Out-of-order cancel before list | State machine: cancel on unknown → stay UNKNOWN/UNLISTED; list after cancel wins if newer verified_at |
| Postgres down | Worker logs fatal and exits (Railway restart); web health reports `postgresConnected: false`, `workerOnline: false` |
| Two worker replicas | **Forbidden** in v1 — single replica; `worker_id` singleton; document Railway replica=1 |

## Slice mapping (implementation order)

1. Extract bootable worker entry + heartbeat + health route; disable web constructor start; Railway worker service stub.
2. Metadata retry queue + Brass progress fields on health.
3. Persist/restore all worker fields from Postgres as authority; demote JSON.
4. Stream ingest + reconcile-as-drift; admin INDEXER panel.

## ADRs

- `docs/adr/0002-always-on-market-worker.md`
- `docs/adr/0003-opensea-stream-maintenance.md`

---

Design complete. Next: Staff hat for the risk map.
