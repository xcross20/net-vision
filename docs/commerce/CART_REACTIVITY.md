# Cart reactivity

**Verdict: CART REACTIVITY BLOCK** until staging A–G below are observed.

`CartProvider.items` is the only live cart membership authority. Checkout `phase.items` may hold validated listing facts. After any cart mutation, `reconcileCheckoutWithCart` intersects checkout with current membership. Totals come only from `lib/cart/selectors.ts`.

## Invariant

checkout token set ⊆ current cart token set

Identity is `contractAddress + tokenId` (`cartAssetId`), not tokenId alone.

`cartRevision` increments on ADD / UPSERT / REMOVE / CLEAR / REMOVE_CONFIRMED. Revalidate, USDG status, and prepare responses bind to `{ cartRevision, address, chainId }` and are discarded if any field moved.

## Self-heal (reads only)

| Blocker | Auto-advance |
| --- | --- |
| Disconnected | Connect wallet CTA → shared modal → revalidate |
| Wrong network | Network Gate → 4663 verified → revalidate |
| Item removed | Row/total/required USDG drop immediately |
| Balance insufficient | Poll ~8s while payment_select; CTA flips when sufficient |
| Allowance insufficient | After approval receipt, refetch + revalidate |

Never auto-sign approve, swap, or purchase.

## Manual staging

1. Cart `#20343` + `#35088`, review both, remove `#35088` — review and total must match the remaining item without refresh.
2. Disconnect — primary CTA is **Connect wallet**. Connect — checkout resumes without a second Review click.
3. Wallet on 369 — Switch to Robinhood Chain — resumes on 4663 without refresh.

## Not in this PR

ETH / NET / NVDA routing. `TRADING_ENABLED` flag. USDG live-money E2E PASS.
