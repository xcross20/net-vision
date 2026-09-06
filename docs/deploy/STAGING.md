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

Compare rendered `DATABASE_URL` hostnames:

- production web vs staging web
- production worker vs staging worker

If any staging host equals a production host: **stop**. Provision a new Postgres plugin in staging and rewrite the variable. Do not start the staging worker.

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

## Rollback

Railway: delete the `staging` environment. Git: delete the `staging` branch. Production is unaffected if the DATABASE_URL spike passed and `main` was not merged.
