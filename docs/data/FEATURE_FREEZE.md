# Feature freeze

Commerce features stay off until market-state coverage is materially complete.

## Frozen

- Value Sweep
- Market radar
- Category bids
- New-listings feed driven by incomplete orderbook samples

Cheapest-N Category Sweep, watchlist, and Portfolio list actions are implemented but stay disabled or OpenSea-linked while `marketStatus === 'syncing'` / trading remains gated.

`NEXT_PUBLIC_TRADING_ENABLED` remains `false`.

Indexer V3 (`docs/data/MARKET_INDEXER_V3.md`): live truth moves to OpenSea Stream + Postgres via `apps/market-worker`. Sweep stays frozen until V3 acceptance categories (Brass, 3 Digit, Steel, Palindromes, Repeating) pass the &lt;10s convergence gate.

## Unfreeze criteria (all required)

1. Token registry exists and existing-token count matches OpenSea supply ±1.
2. Number identity invariant is green against `apps/web/fixtures/number-identity.json`.
3. `category_market_stats` equivalent coverage is populated for every deterministic category.
4. 3 Digit listed count converges with OpenSea `Presser: 100–999` within ±2.
5. At least five other categories reconcile with the oracle within ±2 listings.
6. Indexer V3 worker is Online with Postgres authority; web does not run in-process indexer (`INDEXER_IN_WEB` unset/false).
7. Listing/cancel/sale on an acceptance category converges in the UI within 10s (Stream or REST-events primary).

Until then, category pages must show **Syncing market data** whenever coverage is below 95%, and must never present unknown tokens as unlisted.
