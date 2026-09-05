# SPEC: Always-on market indexer independence

**Status:** PM hat — accepted for Architect  
**Date:** 2026-09-05  
**Source:** Operator failure report — bootstrap stalls / appears tied to web traffic and laptop presence

## Problem

Operators of Net Vision cannot trust that Button Presser category markets (especially Brass `1..999`) keep discovering metadata and listings after deploy because market synchronization only progresses when the web process happens to be alive *and* has started its embedded indexer loops — and even then a single failing token or opaque health surface can leave Brass incomplete for hours with no reliable signal that work stopped. That costs wrong floors, empty category markets, and hours of debugging whether anything is syncing at all.

## Acceptance claims

1. **Zero-traffic continuity:** After a fresh deploy, with zero HTTP requests to the website for 60 continuous minutes, worker heartbeats continue updating, the metadata cursor advances (or the retry queue drains with documented backoff), listing reconciliation continues, and category coverage metrics do not freeze solely because nobody visited the site.

2. **Boot independence:** On process start of the indexing runtime, indexing work begins without requiring construction of a market source singleton, a category page hit, a browser session, or any other user-originated request.

3. **Brass gate:** The metadata range `1..999` reaches a verified count of 999 (or an explicit per-token MISSING record for any truly absent IDs) independently of listing-scan progress. Brass completion is observable as a boolean/progress pair on the indexer health surface.

4. **Non-blocking retry:** When a single token's metadata fetch returns a transient failure, later token IDs in the same bootstrap pass continue to be processed; the failed token is scheduled for later retry with increasing delay. One stuck token cannot freeze Brass for hours.

5. **Health truthfulness (silent-failure claim):** `/api/v1/health/indexer` reports worker online/offline from heartbeat freshness (`now - worker_heartbeat_at > 60s` ⇒ unhealthy), separate listing and metadata cursors/progress, Brass verified vs expected, last successful listing and metadata checks, last error, last 429, retries queued, and whether the authoritative store is reachable. A green "indexer running" flag while metadata is stalled is a failed claim.

6. **Authoritative persistence:** Worker cursors, retry queue, heartbeats, and market observations survive a process restart by restoring from the authoritative store (not only from a local JSON file that may be empty after redeploy). After restart, cursors resume at or after the last persisted progress (no silent reset to zero when prior progress existed in the store).

7. **Post-bootstrap freshness intent:** After initial bootstrap of a range, a newly created listing/sale/cancel for a known token becomes reflected in Net Vision market state without requiring a full `1..62095` rescan to reach that token. (Realtime event path or equivalent event-driven update.)

## Non-goals (this release)

- Speeding up OpenSea REST polling as the primary "fix" (no "just lower PACE_MS").
- Replacing OpenSea as the external marketplace source.
- Perfect historical backfill of every past sale event.
- Multi-collection support beyond Button Presser.
- Removing the web app's ability to *read* market state (web remains a consumer).
- Full migration of every legacy JSON helper off disk for local-only developer workflows (local JSON fallback for dev/debug is allowed).

## Slices

1. **Always-on worker + heartbeat + indexer health** — indexing runtime starts on boot; heartbeat every 15s; `/api/v1/health/indexer` exposes the fields in claim 5; web process no longer required to start loops. Zero-traffic continuity measurable.

2. **Non-blocking metadata retries + Brass gate** — RETRY enqueues with exponential backoff; cursor advances; Brass `999/999` observable independently of listings.

3. **Authoritative Postgres worker/market state** — cursors, retries, heartbeats, and market rows restore from Postgres across restarts; JSON demoted to local fallback only.

4. **Event-driven maintenance + slow reconciler** — listings/sales/cancels/offers/transfers update affected tokens without full rescan; full scan retained only as drift detection.

5. **Operator visibility** — admin INDEXER panel showing online status, listing/metadata progress, Brass/Steel/Anodised/Printed progress, retries, last success, last 429.

## Door class

**One-way** — because worker process topology, health contract, and authoritative store semantics become deployment and operational dependencies (Railway services, monitoring, restore-after-restart). Reversing after cutover strands in-flight cursors and dual sources of truth.

## Riskiest unknown

Whether OpenSea Stream (or equivalent event feed) is available and sufficiently complete for Button Presser on Robinhood Chain such that claim 7 can be met without inventing a second fragile poller — if Stream is unavailable or incomplete, "realtime maintenance" may still require a bounded event/reconcile strategy that must be proven before declaring post-bootstrap freshness done.

## Deployment acceptance test (manual)

```text
close developer laptop
zero website traffic for 60 minutes
worker heartbeat continues
metadata cursor continues increasing (or retries drain)
listing reconciliation continues
authoritative store row counts / coverage continue increasing
category coverage continues increasing
```

This test must pass before background synchronization is considered complete.

---

Spec complete. Next: Architect hat.
