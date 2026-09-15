# Commerce execution gap

**Date:** 2026-09-10  
**Inspected (do not assume PR bodies):**

| Ref | SHA / state |
| --- | --- |
| `origin/staging` | `deff1a5` (PR #23 WAL/nav) |
| PR #26 `feat/commerce-checkout-v2` | `35835da` MERGEABLE, CI check SUCCESS |
| PR #25 image fallback | `89e11f1` MERGEABLE, separate track |
| PR #21 payment-router | `4f3f2ee` MERGEABLE but **BEHIND** staging; 11 files, package-only |
| Chain SoT | `ROBINHOOD_CHAIN.id = 4663` |
| USDG SoT | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` decimals 6 |
| Seaport SoT | `0x0000000000000068F116a894984e2DB1123eB395` |
| `TRADING_ENABLED` | unset/false (kill switch fail-closed) |

## CURRENT COMMERCE STATE

```
DONE / STRONG
✓ chain 4663
✓ cart chosen as buy checkout authority (PR #26 code)
✓ BuyDrawer demoted to BuyNowButton re-export
✓ only CartCheckout fetches /api/trade/buy/prepare
✓ acceptedOrderHash + acceptedPriceRaw required
✓ receipt.status === success before cart remove
✓ partial fill → recovery
✓ payment picker: USDG executable in UI; ETH/NET/NVDA coming soon
✓ TRADING_ENABLED false

STILL BLOCKING MONEY
→ live OpenSea fulfillment payload not captured
→ no USDG balance/allowance states in checkout
→ no explicit LISTING_REVALIDATING_FINAL between payment select and prepare
→ no post-receipt ownership/activity/portfolio proof
→ PR #21 not rebased onto cart authority
→ ETH / NET / NVDA not executable
```

## Sibling-risk search (buy execution)

| Mechanism | Callers | Verdict |
| --- | --- | --- |
| `fetch('/api/trade/buy/prepare')` | **only** `CartCheckout.tsx` | PASS |
| `sendTransactionAsync` | `CartCheckout` (buy) + `OfferActions` (accept offer) | buy PASS; accept-offer is a **separate** executor |
| `writeContract` | none | PASS |
| `wallet_sendTransaction` | none | PASS |
| Direct Seaport / fulfillment in UI | none | PASS |

`OfferActions` still treats hash-as-success (`phase: 'sent'`). Surface `accept_offer` defaults **disabled** (`ACCEPT_OFFER_ENABLED` false + master kill switch). Not a buy-path CART AUTHORITY fail. Classify P1 sell-side.

## Classification

### P0 EXECUTION BLOCKER

1. **No live fulfillment authority record.** Prepare is unproven against a real OpenSea payload on 4663. Cannot declare USDG CHECKOUT PASS.
2. **No live-money USDG receipt.** Unit tests ≠ E2E.
3. **Unknown USDG balance rendered implicitly as “just buy”.** Checkout never queries ERC-20 balance; insufficient funds fail at wallet/simulation, not in review. Unknown ≠ 0 is not implemented for payment.
4. **Spender/allowance not derived from live fulfillment.** If Seaport needs USDG allowance, checkout does not check or request bounded approval. Silent revert risk.
5. **`TRADING_ENABLED` must stay false** until (1)+(2) exist. Do not flip for convenience.

### P1 REQUIRED BEFORE PUBLIC MULTI-ASSET

6. PR #21 behind staging; must rebase/supersede after cart authority is on staging. Must not prepare NFT txs.
7. CartCheckout skips an explicit final revalidate *client* step; prepare does live `getBestListing` (partial mitigation). Add LISTING_REVALIDATING_FINAL in the UI machine before each item.
8. No post-receipt ownership / listing-gone / activity / portfolio checks.
9. OfferActions receipt-less accept path (disabled). Harden or keep disabled at launch.
10. Quote API + swap proof + replay protection not present (needed for ETH/NET/NVDA, not USDG direct).
11. NET ticker collision not encoded as canonical `netnet-net` asset id in chain-config (picker uses symbol `NET`).

### P2 POST-LAUNCH

12. Best-route ranking.
13. Batched cart swap.
14. Additional stock tokens after NVDA adapter.
15. Checkout observability event log persistence.
16. PR #25 image pending (trust, not money) — merge before public traffic, not on this mutation.

## Gates (this inspection)

| Gate | Verdict |
| --- | --- |
| CART AUTHORITY | **PASS** for buy path (code). Staging smoke after merge. |
| USDG CHECKOUT | **BLOCK** |
| PAYMENT ROUTER INTEGRATION | **BLOCK** (PR #21 behind; not wired) |
| ETH / NET / NVDA | **BLOCK** |
| MULTI-ASSET CHECKOUT | picker only |
| TRANSACTION FIREWALL | prepare+policy exist; unproven vs live payload |
| TRADING_ENABLED | **false** (correct) |

## NEXT P0

1. Merge PR #26 (CI green, MERGEABLE).
2. Capture `docs/launch/BUY_FULFILLMENT_AUTHORITY.md` from a real listing (no trading enable).
3. USDG hardening PR: balance tri-state, allowance from decoded spender, final revalidate, receipt reconciliation hooks.
4. Operator live-money E2E with explicit temporary enable — only then USDG CHECKOUT PASS.
