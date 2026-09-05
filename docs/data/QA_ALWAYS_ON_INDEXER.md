# QA: Always-on indexer (slices 1–3)

**Date:** 2026-09-05  
**Claims under test:** SPEC_ALWAYS_ON_INDEXER.md claims 1–6 (claim 7 Stream gated)

## Once-red tests

| Claim | Test | Result |
| --- | --- | --- |
| Non-blocking RETRY | `worker.test.ts` enqueues retry and advances cursor | green (was red under old head-of-line throw) |
| Heartbeat unhealthy | `health.test.ts` workerOnline false when heartbeat stale | green |
| Brass independent of listings | `health.test.ts` brass count with listing cursor 0 | green |
| Boot requires key | `run-market-worker.ts` without OPENSEA_API_KEY exits 1 | manual green |

## Not verified here

- 60-minute zero-traffic Railway acceptance (needs second service live)
- Browser pass of `/admin/reconcile` INDEXER panel (no browser tools in this session)
- OpenSea Stream spike (`scripts/spike-opensea-stream.ts` — slice 4 gate)

## Release tripwire

Do **not** deploy web-only with this branch unless `INDEXER_EMBEDDED=true` temporarily: production default stops embedded loops. Deploy `net-vision-market-worker` in the same change window.
