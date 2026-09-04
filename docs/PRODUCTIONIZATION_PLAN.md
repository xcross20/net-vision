# Net Vision Productionization Sprint Plan

Status: In progress. The repository is at the ideal point for this change. The taxonomy, chain config, transaction policy, and OpenSea gateway packages are the boring but important work that is already complete and tested. The next move is to replace the presentation and data layers around those foundations.

This document is the source of truth for the productionization sprint. It is audited against the v1.1 specification, the current repository state, and the current OpenSea v2 API surface.

## Audit: Current state vs required state

| Area | Current | Required | Status |
| --- | --- | --- | --- |
| `packages/taxonomy` | Pure deterministic classifier with 24 fixtures | Keep as-is | Done |
| `packages/chain-config` | Allowlist for Button Presser contract and Seaport v1.5 | Keep as-is; surface canonical chain slug from `/api/v2/chains` | P0 |
| `packages/opensea-client` | Read gateway with Zod, retries, timeouts | Add `getChains`, `getNFT`, `getProfileListings`, `getAccountOffers` | P0 |
| `packages/transaction-policy` | Adversarial suite, 15 cases | Keep as-is; integrate into Buy/Accept-Offer flows | P3 |
| `apps/web` data layer | `getSeededTokens()`, seeded prices | Replace with cache-backed reads from OpenSea | P0 |
| `apps/web` pages | Engineering prototype look | Premium terminal aesthetic | P1 |
| Wallet infrastructure | None | wagmi + viem + react-query | P3 |
| Buy / Make Offer / List | Disabled banners | Real fulfillment_data flow gated by policy | P3 |
| Category analytics | Computed from seed | Computed from live orders with freshness | P5 |

## P0: Eliminate seed data from production

The current `apps/web/lib/data/seed.ts` and `apps/web/lib/data/categories.ts` compute everything from a deterministic local fixture. That is acceptable for tests and for first paint while OpenSea is unreachable, but it must not be the source of truth in production.

### Changes

1. Add a chain discovery method to `packages/opensea-client`. The first call on server boot calls `/api/v2/chains`, finds the canonical slug for Robinhood Chain, and stores it in the cache. The hard-coded default `"Robinhood"` is removed.
2. Add the read methods the product actually needs:
   - `getChains()`
   - `getNFT({ chain, contractAddress, tokenId })`
   - `getCollectionListings({ slug })` (already present)
   - `getBestListing({ slug, tokenId })` (already present)
   - `getListingFulfillmentData(...)` (already present, write path)
   - `getOfferFulfillmentData(...)` (write path)
   - `getListingActions(...)` (write path)
   - `getProfileListings({ address })`
   - `getAccountOffers({ address })`
3. Build `apps/web/lib/market/cache.ts`. A thin read-through cache with a `MarketSource` interface that the in-memory implementation satisfies today. The interface is shaped so a Redis or Postgres implementation can replace it without touching the routes.
4. Replace the production read paths in `apps/web/lib/data/*` with cache-backed reads. Seed fixtures move to `apps/web/lib/data/__fixtures__/` and are used only by tests.
5. Update `/api/health` to expose the canonical chain slug, last refresh timestamp, and a `dataFresh` flag.
6. Every page renders a `DataFreshnessBadge` showing the last OpenSea sync timestamp. If freshness exceeds the SLA, the badge degrades and listings are marked stale.

### What stays

- The deterministic seed becomes a vitest fixture only. No production read imports it.
- All existing taxonomy, chain-config, opensea-client, and transaction-policy tests remain green.

## P1: Production frontend redesign

The current visual language is honest engineering but reads as a Tailwind dashboard starter. The target aesthetic is:

```
NetNet product family + modern crypto trading terminal + legacy ENS Vision information architecture
```

### Changes

1. Build a new primitives package on top of `@net-vision/ui`:
   - `MarketHeader` (logo, global nav, search, connect)
   - `StatRow` (label + value + delta, mono numerals)
   - `TokenTile` (image, name, traits, price, buy CTA, marketplace badge)
   - `MarketRow` (dense horizontal row for the activity leaderboard)
   - `DataTable` (used by `/market`, `/activity`)
   - `CategoryRow` (the ENS Vision-inspired dense directory row)
   - `TokenHero` (large image, attribute column, action column)
   - `Drawer` (transaction review)
   - `DataFreshnessBadge`
   - `MarketplaceBadge`
2. Redesign every page to use these primitives. No inline layout hacks.
3. Replace placeholder SVG media with OpenSea `image_url` when present, otherwise the deterministic SVG fallback.
4. Remove every developer-facing string from customer UI: no "seed", no "read-only slice", no "virtual collection" (use **Categories**), no "indexed supply", no implementation language.
5. Use real numerals with tabular figures. Use a restrained NetNet green for actionable states. Use thin low-contrast borders. Use near-black surfaces, not bright card grids.
6. No em dashes anywhere in customer copy or documentation.

## P2: Core production pages

1. `/` — premium market homepage with hero stats, trending categories, market activity leaderboards (sales + offers).
2. `/market` — full marketplace with filters and sort.
3. `/categories` — dense ENS Vision-inspired directory.
4. `/categories/[slug]` — analytics + actual listings.
5. `/tokens/[tokenId]` — premium commerce.
6. `/activity` — sales + offers leaderboards.
7. `/portfolio` — connected-wallet Button inventory.

## P3: OpenSea commerce

1. Add dependencies:
   - `wagmi`
   - `viem`
   - `@tanstack/react-query`
   - `@walletconnect/ethereum-provider` (optional, behind a flag)
2. Wire a `WalletProvider` and a `Connect` button into the global header.
3. Buy Now:
   - Server `POST /api/trade/buy/prepare` re-fetches best listing, validates with `validateTradeAction`, optionally simulates, and returns OpenSea `fulfillment_data`.
   - `BuyDrawer` shows the review screen (asset, seller, price, currency, fees, network, max total, approvals, expiry).
   - Wallet signs and broadcasts. Status is polled and reflected in the UI.
4. Make Offer:
   - Server `POST /api/trade/offer/prepare` validates bounds and returns the offer payload.
   - User signs EIP-712 typed data.
5. List on OpenSea:
   - Server `POST /api/trade/list/prepare` returns OpenSea `listing_actions`. Approval step is separated from the listing signature.
   - User signs approvals and the typed order in turn.
6. Accept Offer:
   - Server `POST /api/trade/accept-offer/prepare` returns OpenSea `offers/fulfillment_data`.

### Critical safety rules

- OpenSea API key remains server-only. The browser calls Net Vision endpoints, never OpenSea directly.
- Every executable action passes `validateTradeAction` before the wallet is asked to sign.
- Order hash is pinned at review time. Re-fetch at preparation; require renewed confirmation on drift.
- Approvals are bounded by default. Unlimited approvals are opt-in only.
- Wallet signs transactions. Net Vision never signs for users.
- On chain or account change, the session is invalidated and any in-flight trade intent is dropped.

## P4: Commerce UX

- Connect Wallet modal that does not ask for a seed phrase under any circumstance.
- Add to Cart (persistent, simple localStorage-backed cart for MVP).
- Buy Now, Make Offer, List actions that open review drawers.
- Transaction review showing every required field per the spec.
- Price-change protection: re-fetch at preparation and require a renewed click.
- Success, failure, replaced, and expired states.
- View on OpenSea attribution link on every listing row and token detail.
- Marketplace source badge on every listing.

## P5: Category market intelligence

For every category, compute from the cache:

- floor (lowest valid executable listing among members)
- listed count (unique tokens with at least one executable listing)
- owners (unique wallet addresses across members)
- top sale (max last-sale in window)
- top offer (max best item offer in window)
- 24h sales count
- 24h volume
- 7d sales count
- 7d volume
- recent activity

Every metric is paired with a freshness timestamp and a confidence label where the sample size is small. No implied valuation.

## P6: QA gates before mainnet

Mainnet trading remains feature-flagged off until:

- `npm test` is green across all workspaces.
- Wrong-chain, wrong-contract, manipulated-price, stale-order, wrong-token, and approval-target tests all pass.
- Transaction simulation passes against the latest block.
- OpenSea schema contract tests pass for every endpoint in use.
- Mobile Playwright flows cover Buy Now, Make Offer, and List at 375px.
- Wallet account-change behavior is verified (drop in-flight intents, refresh CSRF/session).
- A bundle scan confirms the OpenSea API key value never reaches client output.
- A controlled end-to-end buy is confirmed onchain and reflected in the UI.

## Vertical slicing and checkpoints

Each slice ends with:

1. `npm run build` green for the web app.
2. `npm test` green across all workspaces.
3. A working deployment to Railway at `web-production-38d29.up.railway.app`.
4. A commit on `main` with a clear message.

If any of those fail, the slice is not done. The next slice does not start.

## Out of scope for this sprint

- The Postgres-backed indexer (PR 2 in the spec). The cache layer is shaped so a Postgres implementation can drop in without touching the routes.
- Full Net Vision native orderbook with 0% fee (PR 8 / spec section 38). Specified, not implemented.
- Sweep that calls OpenSea's `/api/v2/listings/sweep` end to end (PR 11). The basket guard exists; the sweep submission lands in a later slice.
- Historical OHLC-like virtual floor charts (PR 12). The cache stores the inputs; the charts land later.
