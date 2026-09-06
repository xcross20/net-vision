# Staging environment

Persistent integration environment for Net Vision. Spec: `docs/data/SPEC_STAGING_ENVIRONMENT.md`. ADR: `docs/adr/0005-staging-environment.md`.

## Policy

```
feature/*  →  PR  →  staging  →  Release Readiness PASS  →  promotion PR  →  main
```

- `main` is production. Feature branches do not deploy there.
- Staging PASS does not skip production smoke after `main` deploys.
- Time passing does not merge `staging` → `main`.

## Topology

| | Staging | Production |
| --- | --- | --- |
| Git branch | `staging` | `main` |
| Railway env | `staging` | `production` |
| Web | staging domain | `web-production-38d29.up.railway.app` |
| Worker | 1 replica | 1 replica |
| Postgres | **own instance** | production instance |
| Trading | forced off | gated by coverage + flags |
| `MARKET_READ_MODEL` | `blob` until A5 | `blob` until A6 |

## Execution-safe flags (staging web + worker)

```
TRADING_ENABLED=false
NEXT_PUBLIC_TRADING_ENABLED=false
BUY_ENABLED=false
SWEEP_ENABLED=false
ACCEPT_OFFER_ENABLED=false
INDEXER_EMBEDDED=false          # web
MARKET_INDEX_WRITER=true        # worker only
```

Staging may use the real OpenSea key and Button Presser Stream for indexing.

## Spike (required before staging worker stays up)

`postgres.railway.internal` is the **same DNS name in every environment** and is not isolation evidence. Compare **volume instances**:

```
parent volume postgres-volume c4c01710-…
  production instance a9d369af-…  ~1407 MB
  staging    instance bc0f046a-…  ~134 MB

parent volume web-volume 378e8731-…
  production instance 2b766ce4-…  ~192 MB
  staging    instance f66d295f-…  ~4 MB
```

Instance IDs and sizes differ → isolated disks. If instance IDs were equal, stop and provision a new volume; do not start the staging worker.

Railway environment:

| | ID |
| --- | --- |
| production | `138cf108-b3f7-4393-b9f1-0d6e4e83ab7d` |
| staging | `5110f64d-9cf8-4203-993f-63651631259e` |

Staging web domain: `web-staging-46e2.up.railway.app`

Duplicate-from-production auto-started deploys from `main`. Those were cancelled. Staging `market-worker` stays down / `INDEXER_V2_ENABLED=false` until A1 is on `staging` and production OpenSea quota is not contended.

Do **not** `railway environment delete staging` while diagnosing volume IDs — parent volume IDs are shared even when instances are isolated; deleting the wrong object is a production-data risk.

## Forbidden

- `railway__connect-service-source` with `branch=staging` — that tool applies to **all** environments and would retarget production off `main`.
- Pointing staging at production Postgres.
- Enabling trading on staging.
- Merging `feat/sql-market-read-model` to `main` before staging A1 apply + worker health.

## Production smoke (after any `main` deploy)

Still required. Staging PASS is not a substitute.

1. `GET /api/v1/health/indexer` → `workerOnline: true`, heartbeat &lt; 60s
2. Stream connected / REST maintenance present
3. `snapshotRevision` advancing
4. Homepage + `/categories` load
5. Known listing still listed
6. Trading remains gated unless explicitly enabled

## Open (ops, not A1 code)

1. In the Railway dashboard, staging environment only: set web and `market-worker` deploy branch to `staging`. Do **not** use `connect-service-source` / `serviceInstanceUpdate` for this — those apply to all non-fork environments and would retarget production.
2. Bring up staging Postgres, then web. Domain: `web-staging-46e2.up.railway.app`.
3. Leave staging `INDEXER_V2_ENABLED=false` until production `last429At` is quiet; then enable the staging worker so A1 `ensureSchema()` can run.
4. A2–A7 are not this slice.

## Rollback

Do **not** delete the Railway `staging` environment as a first response — parent volume IDs are shared by design. Scale staging services to 0 / cancel deploys instead. Git: revert the PR on `staging`. Production `main` is unaffected.
