# Mobile Commerce

Status: Read-only slice ships the mobile-first token detail above the fold. Trade actions are gated behind the safety suite.

## Above-the-fold rules

On a 375px-wide viewport, the user must be able to see, without scrolling:

- The asset image (large).
- The collection name and the token number.
- The current ask.
- The owner (truncated).
- Buy Now, Make Offer, and Add to Cart (the latter two may be visually de-emphasized).

## Layout

- Single-column on mobile.
- Two-column on tablet and up: image on the left, commerce panel on the right.
- The commerce panel uses the `nv-panel` token with consistent border radius and padding.

## Trade actions

Trade actions are disabled in the read-only slice. The buttons render with the `nv-button-disabled` style and an `aria-disabled="true"` attribute. The `TradingGateBanner` explains why and points to the safety suite.

When live trading is enabled:

- Buy Now shows the latest price and a confirm drawer before opening the wallet.
- Make Offer shows the offer terms and a confirm drawer before opening the wallet.
- Add to Cart accumulates selections in a persistent cart and exposes them on `/cart`.
- The transaction review screen renders before any wallet signature.

## Below the fold

- Traits (chip list, every trait the deterministic taxonomy assigned).
- Categories (linked chips for every non-digit trait).
- Contract (allowlisted Button Presser contract with chain display name).

## What we explicitly avoid

- Hero carousels. The asset is the hero.
- Aggressive countdown timers.
- Sticky trade action bars that hide content.
- Hidden fees. Fees are part of the review screen, not the listing row.

## Performance targets

- Token detail API: under 500 ms at p95 (excluding upstream cold failure).
- LCP under 2.5 s at p75 on modern mobile.
- Trade review screen renders in under 4 s at p95 when OpenSea and RPC are healthy.
