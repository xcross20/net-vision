# RISK MAP: Always-on market indexer

**Status:** Staff hat  
**Consumes:** SPEC + DESIGN + ADR 0002/0003

Risk = probability × cost × invisibility. Ranked highest first.

## 1. Worker looks healthy while metadata is stalled (false green)

A heartbeat process runs, but the metadata loop is blocked on RETRY head-of-line or silently not scheduled — `/health` still says “online.”

- **P:** H (current design already exhibits this class)  
- **Cost:** H (Brass incomplete for hours; wrong markets)  
- **Invisibility:** H (operator trusts green)  
- **Mitigation:** Separate listing vs metadata last-success timestamps; expose `retriesQueued`, Brass verified/expected; unhealthy if heartbeat stale **or** metadata phase not `done` and `last_success_metadata_at` older than threshold while retries not draining.  
- **Test:** Unit/integration — freeze metadata success, advance heartbeat → health marks metadata unhealthy / progress frozen visible.  
- **Tripwire:** Alert when `metadata_cursor` unchanged for N minutes during `brass-priority` with `retries_queued` flat or growing without drain.

## 2. Redeploy restores empty JSON and resets cursors despite Postgres having progress

Boot path still prefers empty local file semantics and overwrites or ignores PG.

- **P:** M–H on Railway ephemeral disk  
- **Cost:** H (re-bootstrap 62k; OpenSea burn; Brass regression)  
- **Invisibility:** H (looks like “fresh start”)  
- **Mitigation:** When `DATABASE_URL` set, restore worker_state + tokens from Postgres **before** any write; never let empty JSON win over non-empty PG.  
- **Test:** Seed PG with metadata_cursor=500; empty local file; boot worker → cursor ≥ 500.  
- **Tripwire:** Log + health field `restoredFrom: 'postgres'|'json'|'empty'`; alert if `restoredFrom=empty` while PG row count &gt; 0.

## 3. Two writer processes (web embedded + worker) corrupt shared state

Web constructor still starts loops while worker also writes.

- **P:** M if flag forgotten  
- **Cost:** H (cursor races, revision fights)  
- **Invisibility:** M  
- **Mitigation:** Default `INDEXER_EMBEDDED=false`; remove start from market source constructor; worker is sole writer in prod.  
- **Test:** Assert `OpenSeaMarketSource` construction does not call `startBackgroundIndexer` unless embedded flag set.  
- **Tripwire:** Health exposes `writerIdentity`; if two heartbeats with different `worker_started_at` collide, mark conflict.

## 4. OpenSea Stream receives nothing for Button Presser / Robinhood Chain

Slice 4 ships websocket client; events never arrive; freshness claim silently fails.

- **P:** M (unknown chain coverage)  
- **Cost:** H for claim 7  
- **Invisibility:** H without spike metrics  
- **Mitigation:** Mandatory spike before Stream code is “done”; fallback to collection-events REST window; reconciler always on.  
- **Test:** Spike script records event count over 15m; CI/manual gate.  
- **Tripwire:** `streamEventsLast15m == 0` while REST collection events &gt; 0.

## 5. Retry queue grows without bound under sustained 429s

Every token enqueued; memory/PG bloat; little forward progress.

- **P:** M  
- **Cost:** M  
- **Invisibility:** M  
- **Mitigation:** Cap queue size; global 429 cooldown pauses new REST; backoff schedule; prefer draining retries during cooldown end.  
- **Test:** Inject 429 storm → queue capped, cursor may pause but process heartbeats.  
- **Tripwire:** `retries_queued > 500` alert.

## 6. Railway worker service never actually deployed / wrong start command

Code lands; only web still runs.

- **P:** M  
- **Cost:** H  
- **Invisibility:** H if only web health checked  
- **Mitigation:** Document second service; deployment acceptance test (60m zero traffic); health `workerOnline` false fails release checklist.  
- **Test:** Manual deploy checklist in SRE hat.  
- **Tripwire:** Synthetic check: after deploy, `workerOnline` must be true within 2 minutes with zero page hits.

## Clean zones

- Taxonomy classification (`@net-vision/taxonomy`) — pure, unchanged.
- Listing state machine transitions — reuse; don’t redesign in this work.
- Transaction policy / wallet hardening — out of scope.
- Category UI read paths — continue reading MarketSource; only stop starting the worker.

## Spike required

**Unknown:** Does OpenSea Stream deliver Button Presser events?

**Experiment:** Run a 15-minute subscriber against the collection slug with the production API key; concurrently note REST activity (new listings). Record event counts by type.

**Result:** *Pending — gate for slice 4 only. Slices 1–3 proceed.*

**Budget:** Deep care on risks **1** and **2**. Speed on clean zones and UI chrome.

---

Risk map complete. Next: Implementer hat. Budget: deep care on items 1–2, speed everywhere else.
