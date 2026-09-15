# Cart checkout V2

**Authority:** one cart, one checkout state machine, one purchase engine.
**Chain:** Robinhood mainnet `4663` (`docs/launch/CHAIN_AUTHORITY.md`).
**Settlement:** USDG. ETH / NetNet NET / stocks route into USDG only after each route independently PASSes.
**Kill switch:** `TRADING_ENABLED` remains false until live-money USDG E2E PASS.

## Entrances

Every Buy action must enter `CartProvider.buyNow` or `add` + `requestReview`:

- Token page `Buy now` → `BuyNowButton`
- Category card `Buy now` → `BuyNowButton`
- Add to cart → `AddToCartButton` then Review
- Sweep (future) → same cart

`BuyDrawer` is retired as an executor. It no longer calls `/api/trade/buy/prepare`.

## State machine

See `apps/web/lib/cart/checkout-machine.ts`.

USDG path:

`BROWSING → REVALIDATING → REVIEW → PAYMENT_SELECT → PAYMENT_READY → LISTING_REVALIDATING_FINAL → PURCHASE_PREPARING → PURCHASE_SIGNING → PURCHASE_PENDING → CONFIRMED`

Non-USDG (not executable yet):

`PAYMENT_READY → SWAP_SIGNING → SWAP_PENDING → USDG_CONFIRMED → LISTING_REVALIDATING_FINAL → …`

If a swap succeeds and the listing is then gone: `RECOVERY`. User keeps resulting USDG. Never substitute another NFT. Never `CONFIRMED`.

## Prepare contract

`POST /api/trade/buy/prepare` requires:

- `tokenId`
- `buyerAddress`
- `acceptedPriceRaw` (mandatory)
- `acceptedOrderHash` (mandatory)

No UI may omit those fields. Confirmed is only after `receipt.status === 'success'`.

## Payment picker

Selectable today: **USDG** (`verified_enabled`).

Visible but not executable: ETH, NET (NetNet), NVDA — labeled **Coming soon**. Unknown balances are not rendered as 0.

## Multi-item

Sequential per NFT. Item 1 success + item 2 failure → recovery, not full-cart success. Confirmed items leave the cart; failed items stay.

## Gates

| Gate | Current |
| --- | --- |
| CART AUTHORITY | in progress (BuyDrawer retired; machine tests) |
| USDG CHECKOUT | BLOCK until live-money E2E |
| ETH / NET / NVDA routes | BLOCK (coming soon) |
| MULTI-ASSET UI | picker present; non-USDG not executable |
| TRADING_ENABLED | false |
