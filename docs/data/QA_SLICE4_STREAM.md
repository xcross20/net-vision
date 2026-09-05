# QA: Slice 4 OpenSea Stream + bounded REST events

**Date:** 2026-09-05  
**Claim:** SPEC_ALWAYS_ON_INDEXER.md claim 7 (post-bootstrap freshness)

## Spike (ADR 0003)

- Client joined `collection:button-presser` on OpenSea Stream (5 topics).
- 15-minute event counts recorded in spike log (`apps/web/scripts/spike-opensea-stream.ts`).
- REST collection events remain the mandatory catch-up path (Stream does not replay misses).

## Once-red tests

| Claim | Test | Result |
| --- | --- | --- |
| Cancel is authoritative | listing-state: matching cancel → UNLISTED_VERIFIED; other hash ignored; UNKNOWN stays UNKNOWN | green |
| Token-local list | apply-event: Stream `item_listed` for #966 → LISTED without walking supply | green |
| Token-local sale | apply-event: `item_sold` unlists + records sale; duplicate id ignored | green |
| REST parse | apply-event: collection `listing` event → LISTED | green |
| Health surface | health.test: `maintenance.mode` present | green |

## Operator tripwire

`GET /api/v1/health/indexer` → `maintenance.eventsLast15m == 0` **and** `maintenance.restLastPollAt` stale (> 3 min) while workerOnline is true → maintenance is dead, not just a quiet collection.

`streamConnected: true` with `eventsLast15m == 0` while REST events arrive is the Stream-gap tripwire (ADR 0003 §4). REST poll still applies those events.

## Not claimed

- Stream delivery of every Robinhood event (best-effort).
- Removing the slow listing reconciler.
