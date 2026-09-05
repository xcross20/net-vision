# ADR 0002: Always-on market worker + Postgres authority

**Status:** Accepted  
**Date:** 2026-09-05  
**Spec:** `docs/data/SPEC_ALWAYS_ON_INDEXER.md`

## Context

Market indexing currently runs as fire-and-forget loops inside the Next.js web process, started lazily when `OpenSeaMarketSource` is constructed. Railway deploys only `npm run start --workspace=apps/web`. After redeploy, the indexer may not run until traffic hits a route that constructs the market source. Local JSON is the working store; Postgres is dual-write backup restored only when the local file is empty. Operators cannot tell whether metadata bootstrap (Brass) is alive from existing health.

ADR 0001 deferred a separate worker until operationally necessary. Cold-boot and zero-traffic stalls show that threshold is met.

## Decision

1. Deploy a **second Railway service** `net-vision-market-worker` whose process entrypoint starts indexing immediately on boot (no HTTP, no market-source construction).
2. Make **PostgreSQL authoritative** for worker cursors, heartbeats, retry queue, tokens, facets, and listing state when `DATABASE_URL` is set. JSON remains a local/dev fallback only.
3. **Remove** (production path) indexer start from `OpenSeaMarketSource` constructor. Web becomes a reader of the authoritative store.
4. Expose operator truth on `/api/v1/health/indexer` backed by persisted worker state + heartbeat freshness.

## Alternatives considered

### A. Keep indexer in the Next.js process but start it from `instrumentation.ts` / server boot hook

- Pros: one Railway service; less deploy surface.
- Cons: Next.js process lifecycle still ties indexing to web deploys, build phases, and serverless-ish assumptions; healthcheck does not prove worker liveness as a separate failure domain; harder to scale/restart indexer without bouncing the site.
- **Kill fact:** Spec acceptance requires indexing to continue with zero website traffic and an independent unhealthy signal when the worker dies while the site may still serve. Co-locating cannot separate those failure domains cleanly on Railway’s single-process web service.

### B. Separate always-on worker + Postgres authority (chosen)

- Pros: matches zero-traffic and boot-independence claims; restart/redeploy of web does not stop indexing; heartbeat is a real process signal.
- Cons: second service to configure; must enforce single replica; shared schema migrations discipline.
- Kill fact against rejecting this: the current embedded design already failed the operator’s continuity test.

## Consequences

**Verified**

- Existing `worker_state` table and `pg.ts` schema are a starting point; fields must expand (heartbeat, metadata cursors, retry queue).
- `railway.toml` today only starts web — a second service definition/docs are required (Railway multi-service is project-level, not always a single toml).

**Recalled**

- Dual-write blob upsert already uses revision guards; moving authority to row-level upserts reduces reliance on full-snapshot rewrite every N tokens.

**Guess**

- Nixpacks/tsx boot for `apps/market-worker` will work similarly to existing `npx tsx` scripts; confirm on first deploy.

## Revisit if

- Railway forces a topology where a second Node service is unavailable (unlikely).
- Postgres becomes optional again for a constrained demo environment — then document explicit `INDEX_STORE=json` and accept zero multi-instance continuity.
