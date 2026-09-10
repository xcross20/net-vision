# USDG Buy E2E

**Status:** BLOCK until live-money evidence exists. `TRADING_ENABLED` stays false.

## Required path

1. Listing on staging/production marketplace
2. Buy now or Add to cart → cart checkout (not BuyDrawer)
3. Revalidate listings (`/api/trade/cart/revalidate`)
4. User accepts live price / order hash (and drift if changed)
5. Pay with USDG (direct)
6. Final listing revalidation
7. `POST /api/trade/buy/prepare` with `acceptedPriceRaw` + `acceptedOrderHash`
8. Transaction-policy firewall
9. `eth_call` simulation
10. Wallet confirmation
11. `waitForTransactionReceipt` → `status === 'success'`
12. Market + portfolio reconciliation
13. Cart removes only confirmed token ids

## Evidence still required

- Real OpenSea fulfillment payload captured in `docs/launch/BUY_FULFILLMENT_AUTHORITY.md`
- Exact Seaport spender / approval amount (no unlimited default)
- Live USDG balance + allowance against that spender
- One successful Robinhood Chain `4663` USDG purchase with receipt

## Non-goals for this gate

- ETH / NET / NVDA execution
- Sweep
- Offers
