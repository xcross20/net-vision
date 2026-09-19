# High-Concurrency Commerce Release Gate

**Status:** **BLOCK** for Buy activation. Code promotion and public browsing remain independent.  
**Date:** 2026-09-15  
**Class:** wallet / trade route + schema (one-way for `purchase_intents` / native `execution_state`)  
**Depends on:** `docs/launch/BUY_FULFILLMENT_AUTHORITY.md`, `docs/commerce/COMMERCE_EXECUTION_GAP.md`, kill switch (`TRADING_ENABLED` / `BUY_ENABLED`)

## Problem

Net Vision already revalidates listings before purchase, binds async checkout responses to wallet/chain/cart revision, waits for receipts, and fails closed on stale responses. That is not enough when 20–100 users target overlapping NFTs.

Operators cannot activate Buy for public traffic because overlapping prepares can duplicate execution records, present a lease as on-chain exclusivity, or confirm from a transaction hash without a successful NFT transfer.

## Invariant

> **Net Vision never promises exclusivity it does not own. Multiple users may attempt the same listing, but only the chain determines the winner, and every loser must fail safely, quickly, and without false confirmation or duplicate state.**

High concurrency must hurt **speed** before it ever hurts **correctness**. Prefer “Rechecking availability…” over duplicate execution, stale fulfillment, or false confirmation.

## Launch view (revised)

```text
Code promotion to production        still PASS (fail-closed flags)
Public browsing                     PASS
Buy activation                      requires this gate PASS
Native List                         separate E2E gate
Sweep                               this gate + partial-fill PASS
Offers                              later
```

`TRADING_ENABLED` / `BUY_ENABLED` stay **false** until every verdict below is PASS.

## Invariants (testable)

1. At most one Net Vision execution may own a native order's `FILL_PENDING` state at a time.
2. OpenSea orders are never presented as exclusively reserved. Net Vision may coordinate locally; the chain remains authority.
3. Every purchase intent has a server-generated (or server-accepted) idempotency key.
4. Replaying the same request cannot create a second purchase.
5. A transaction hash is `SUBMITTED`, not `CONFIRMED`.
6. `CONFIRMED` requires successful receipt plus expected NFT transfer (existing `assertCanMarkConfirmed`; transfer proof is a sibling of this gate).
7. A competing buyer's successful purchase causes later users to receive `SOLD` / `UNAVAILABLE`, never false success.
8. Partial multi-item checkout must report exact per-item results.
9. Traffic spikes may degrade availability but must never weaken transaction validation.
10. Unknown upstream state fails closed for execution.

## Flow (final preparation as late as possible)

```text
Review
↓
Final listing revalidation
↓
Fresh fulfillment prepare (idempotent PurchaseIntent)
↓
Decode + policy check
↓
Simulation
↓
Wallet signature
↓
Broadcast → SUBMITTED
↓
Receipt + transfer proof → CONFIRMED | SOLD_DURING_CHECKOUT | FAILED
```

The gap between final revalidation and submission must stay on the same item loop (already in `CartCheckout`). Do not reuse a review from tens of seconds earlier as fulfillment authority.

## UX (loser)

```text
This NFT was purchased before your transaction completed.

No purchase was made. Your funds remain in your wallet.

[Find Similar]  [Return to Cart]
```

Never “Transaction failed.” Never leave the NFT in a fake `CONFIRMED` state.

Sweep (later slice): exact per-item `PURCHASED` / `UNAVAILABLE`, never `Sweep successful: 5`, never full rollback of settled fills.

## Implement

| ID | Piece | Notes |
| --- | --- | --- |
| A | `purchase_intents` durable table | id, buyer, orderHash, assetIdentity, cartRevision, state, txHash, receiptStatus, createdAt, expiresAt |
| B | Idempotent prepare | same intent id + buyer + orderHash + cartRevision returns existing state |
| C | Atomic native `FILL_PENDING` | `UPDATE … WHERE execution_state = 'AVAILABLE' RETURNING *` |
| D | Expiring preparation leases | 15s UX lock on `order_hash`; not an on-chain reservation |
| E | Single-flight live listing checks | coalesce identical `tokenId` lookups (~1s) |
| F | Bounded OpenSea concurrency | default 8 |
| G | Bounded RPC concurrency | prepare simulation already serialized per request; global semaphore later |
| H | Per-wallet mutation rate limit | prepare path |
| I | Global emergency circuit breaker | OpenSea/RPC 429 trips; **never skip policy/simulation** |
| J | Structured `SOLD_DURING_CHECKOUT` | API `error` code + cart copy |

## Load tests (must run before Buy ON)

1. 50 users, same NFT — at most one native fill path; others fail safe.
2. 100 users, 20 NFTs — no duplicate confirmations.
3. 50 users double-click Buy — one intent per user/order.
4. Replay same HTTP prepare 10 times — same intent.
5. OpenSea latency 5s under 100 buyers — no fabricated availability.
6. RPC 429 — backoff/breaker; no skipped safety checks.
7. Process restart with 10 `FILL_PENDING` — durable recovery.
8. Buyer A confirms while B is between prepare and sign — B gets unavailable/revert recovery.
9. 20 simultaneous 5-item sweeps with overlap — exact per-item outcomes (Sweep slice).
10. Native + OpenSea race same NFT — chain result reconciles.

## Observability

`purchase_prepare_rate`, `purchase_prepare_latency_p95`, `purchase_intents_pending`, `purchase_conflict_rate`, `sold_during_checkout_rate`, `upstream_opensea_latency_p95`, `rpc_latency_p95`, `rpc_429_rate`, `simulation_failure_rate`, `receipt_revert_rate`, `idempotency_replay_rate`, `duplicate_fill_attempt_rate`.

In-process counters ship with this slice. Railway/metrics export is a follow-up, not a reason to skip the counters.

## Verdict (fill at Buy-activation review)

| Gate | Verdict |
| --- | --- |
| SINGLE-ASSET RACE SAFETY | BLOCK until load test 1 |
| IDEMPOTENCY | tests in this slice; live prepare replay still required |
| NATIVE ORDER LOCKING | unit PASS; live native order still required |
| UPSTREAM LOAD PROTECTION | coalescing + OpenSea bound in this slice; RPC breaker BLOCK |
| PARTIAL SWEEP CORRECTNESS | BLOCK (Sweep not in this slice) |
| RESTART RECOVERY | BLOCK until durable restart drill |
| 100-CONCURRENT-USER TEST | BLOCK |
| **PRODUCTION BUY ACTIVATION** | **BLOCK** |

## Mapping to current code

| Already present | Gap this gate closes |
| --- | --- |
| `/api/trade/cart/revalidate` live `getBestListing` | `Promise.all` unbounded; no coalescing |
| `/api/trade/buy/prepare` decode + simulate + policy | no intent id, no lease, no native lock |
| `checkoutRequestBind` | client-only; no durable replay |
| `assertCanMarkConfirmed(receipt === success)` | no `SOLD_DURING_CHECKOUT` product copy |
| `native_listings.status` | no `execution_state` CAS |
| Kill switch | stays off until this gate PASS |
