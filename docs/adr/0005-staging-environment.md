# ADR 0005: Persistent Railway staging + branch promotion

**Status:** Accepted  
**Date:** 2026-09-06  
**Spec:** `docs/data/SPEC_STAGING_ENVIRONMENT.md`

## Context

Net Vision production (Railway project `df70d7dc-8293-4b29-979f-a89591fd9df3`, environment `production` / `138cf108-b3f7-4393-b9f1-0d6e4e83ab7d`) runs:

| Service | Role |
| --- | --- |
| `web` | Next.js, domain `web-production-38d29.up.railway.app` |
| `market-worker` | Stream + walker, 1 replica |
| `Postgres` | `index_blob` + normalized tables |

There is no second environment. Architecture V2 (ADR 0004) and every later market-data change need a production-like system that is not the live coverage walk.

Railway persistent environments isolate services, variables, private networking, and databases, and can auto-deploy from a configured GitHub branch.

## Decision

### Git

```
feature/*  → PR →  staging  → promotion PR + Release Readiness PASS →  main
```

- `main` is production.
- `staging` is the persistent integration branch, created from `main`.
- Feature branches (including `feat/sql-market-read-model`) never deploy to the production environment.

### Railway

```
STAGING (branch: staging)          PRODUCTION (branch: main)
  web                                web
  market-worker (1 replica)          market-worker (1 replica)
  Postgres-staging                   Postgres-production
```

Staging **must not** use production `DATABASE_URL`.

### Execution safety on staging

Staging may use the real OpenSea API key and subscribe to Button Presser Stream (read/index). It must not execute trades:

```
TRADING_ENABLED=false
NEXT_PUBLIC_TRADING_ENABLED=false
BUY_ENABLED=false
SWEEP_ENABLED=false
ACCEPT_OFFER_ENABLED=false
```

`MARKET_READ_MODEL` stays `blob` until A5.

### Gates

| Gate | Proves |
| --- | --- |
| CI on the PR | unit, typecheck, build, invariants |
| Staging | running system: Stream, REST, Postgres, pages, E2E, failure recovery |
| Production smoke after `main` | health, heartbeat, Stream, revision moving, known listing |

Staging PASS does not skip production smoke. Time passing does not merge `staging` → `main`.

PR (ephemeral) environments are deferred.

## Alternatives considered

### A. Feature branches deploy straight to production (status quo)

- **Kill fact:** ADR 0004 cutover cannot be proven without a second Postgres and a second worker. Using production for that risks the live coverage walk and real trading flags.

### B. Separate Railway *project* for staging

- Pros: harder to mix up env vars.
- Cons: duplicates GitHub source, domains, and plugin billing without extra isolation we need; environments already isolate Postgres.
- Lost because Railway environments are the native fit and we already have one project with the GitHub repo connected.

### C. Staging shares production Postgres, “read-only worker”

- **Kill fact:** a staging worker with `MARKET_INDEX_WRITER` would mutate production listings. Even “read-only” staging web against production blob couples deploy risk. Forbidden.

## Consequences

**Verified**

- Railway duplicate-environment copies services and variables; plugin datastores are provisioned per environment when duplicated correctly — must still compare `DATABASE_URL` hosts before starting the staging worker.
- `connect-service-source` applies a repo/branch to the service in **all** environments. Do not use it to set staging’s branch; that would retarget production. Set the branch on the staging environment only (Railway agent / dashboard / per-env config).

**Guess**

- Staging worker will 429 if it shares the production OpenSea key at full walker pace. Acceptable for A1 (schema only). Before A2/A5, consider a slower staging walker or a second key.

## Revisit if

- Duplicate environment binds staging `DATABASE_URL` to production — halt, add a new Postgres plugin, rewrite the variable, then start worker.
- OpenSea rate-limit storms correlate with two workers — split keys or pause staging walker.

## Rollback

Delete the Railway `staging` environment and the `staging` git branch. Production is unchanged if we never merged to `main` and never reused production Postgres.
