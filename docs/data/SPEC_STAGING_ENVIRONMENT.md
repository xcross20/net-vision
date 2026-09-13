# SPEC: Persistent staging environment

**Status:** Accepted  
**Date:** 2026-09-06  
**Class:** infrastructure (one-way for the promotion policy; two-way for the Railway objects)  
**Depends on:** Railway environments; ADR 0002 worker topology

## Problem

Engineers cannot prove market-data and architecture changes against a production-like running system without deploying to production `main`, which is currently serving live OpenSea Stream + walker coverage. Staging-class failures (web↔Postgres, worker↔Stream, E2E, cutover flags) are untestable until they are already user-visible.

## Objective

A persistent Railway **staging** environment, isolated from production data and trading, that deploys from the `staging` git branch and is the only path by which architecture/feature work reaches `main`.

## Acceptance claims

1. Git branches: `feature/*` → PR → `staging` → promotion PR → `main`. No feature branch deploys directly to production.
2. Railway project `net-vision` has a persistent environment named `staging` in addition to `production`.
3. Staging has its own Postgres. Staging `DATABASE_URL` is not production’s `DATABASE_URL`.
4. Staging runs `web` + `market-worker` (1 replica) + Postgres. Worker is the sole writer (`INDEXER_EMBEDDED=false` on web).
5. Staging trading is execution-safe: `TRADING_ENABLED=false`, `NEXT_PUBLIC_TRADING_ENABLED=false`, `SWEEP_ENABLED=false`, `ACCEPT_OFFER_ENABLED=false`, `BUY_ENABLED=false`. Staging may subscribe to real Button Presser OpenSea events for indexing.
6. Staging web has a public Railway domain distinct from `web-production-38d29.up.railway.app`.
7. Production services remain on branch `main`. Staging services deploy from branch `staging`. Changing staging’s branch does not retarget production.
8. A documented promotion gate: staging Release Readiness PASS is required before merge to `main`; production smoke is still required after `main` deploys.
9. Production walker/heartbeat is not interrupted by creating staging.

## Non-goals

- PR (ephemeral) environments in this slice.
- Pointing staging at production Postgres “just for now”.
- Enabling trading on staging.
- Auto-merging `staging` → `main` on a timer.
- Copying production `index_blob` into staging as a requirement (staging worker may bootstrap itself).

## Slices

1. Create `staging` git branch from current `main` and push.
2. Create Railway `staging` environment with isolated Postgres + web + worker.
3. Kill-switch trading flags; confirm production untouched.
4. Document the promotion policy in `docs/deploy/STAGING.md`.

## Door class

**One-way for policy** (once teams depend on staging-as-gate, skipping it is a process regression). **Two-way for the Railway environment** (it can be deleted). **One-way if staging is accidentally bound to production Postgres** — that binding is forbidden.

## Riskiest unknown

Railway “duplicate environment” may copy `${{Postgres.DATABASE_URL}}` such that staging web/worker still resolve to production Postgres. Spike: after create, compare rendered `DATABASE_URL` hostnames; if they match, stop and provision a new plugin before any staging worker starts.
