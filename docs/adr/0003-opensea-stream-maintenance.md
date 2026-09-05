# ADR 0003: OpenSea Stream for post-bootstrap maintenance

**Status:** Accepted (slice 4 implemented: Stream + REST poll)  
**Date:** 2026-09-05  
**Spec:** `docs/data/SPEC_ALWAYS_ON_INDEXER.md` claim 7

## Context

After bootstrap, full-collection rescans cannot keep Net Vision continuously synced with live listings/sales. OpenSea documents a Stream API (`@opensea/sdk/stream`) with item listed/sold/cancelled/transferred/metadata/offer events that do not count against REST rate limits. Delivery is best-effort; missed messages are not re-sent.

Riskiest unknown from the PM spec: whether Stream covers Button Presser on Robinhood Chain sufficiently for claim 7.

## Decision

1. **Spike first** (Staff): subscribe to the Button Presser collection slug for ≥15 minutes; confirm at least one live event type arrives (or document zero events while REST shows activity).
2. If Stream delivers events for this collection: implement Stream ingest in the market worker; apply updates to the affected token only; retain slow full reconciliation as **drift detection only**.
3. If Stream does not deliver for this chain/collection: implement a **bounded event poll** (collection events REST, short window) as the maintenance path, still avoiding full `1..62095` token walks for currency; document Stream as blocked.
4. Do not block slices 1–3 (always-on worker, retries, Postgres authority) on Stream.

## Alternatives considered

### A. Polling-only forever (full or partial token walks)

- Pros: already partially built; no new dependency.
- Cons: cannot meet “listed 3 seconds ago” freshness without enormous REST spend; contradicts spec claim 7.
- Kill fact: 62k × pace_ms cannot be the steady-state currency path.

### B. Stream primary + slow reconcile drift (chosen, pending spike)

- Pros: matches industry pattern; events free of REST quota; token-local updates.
- Cons: best-effort gaps require reconciler; chain coverage unknown until spike.
- Kill fact against skipping spike: shipping Stream code that silently receives nothing recreates the false-confidence health problem.

## Consequences

**Verified**

- Official docs: Stream client lives at `@opensea/sdk/stream`; events include listed/sold/cancelled/transfer/metadata/bid.
- Missed messages are not replayed → reconciler is mandatory.

**Recalled**

- Repo does not yet depend on `@opensea/sdk`.

**Guess**

- Robinhood Chain collections may appear on the same mainnet Stream endpoint keyed by collection slug; spike must prove this.

## Revisit if

- Spike shows zero Stream events while REST activity exists → fall back to decision §3 and amend claim 7 test to “events endpoint lag &lt; N minutes” instead of websocket push.

## Implementation (2026-09-05)

- Stream client joins `collection:button-presser` (confirmed).
- Worker always runs a 45s REST collection-events poll as catch-up.
- Token-local apply: listed / sold / cancelled / transferred / metadata.
- Slow listing + metadata loops remain drift/bootstrap.
- Health: `maintenance.{mode,streamConnected,eventsLast15m,restLastPollAt}`.
