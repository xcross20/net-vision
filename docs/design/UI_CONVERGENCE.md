# UI convergence

## Authority rule

Treat the approved generated images as the target visual composition, density, spacing, hierarchy, premium styling, and page layout. Reproduce them as closely as reasonably possible.

Treat live repository data, on-chain media, market state, payment policy, and existing transaction/security logic as the source of truth for content and behavior.

Do not downgrade the visual target because some values or pictured assets in the mockups are illustrative. Replace illustrative content with real data while preserving the presentation pattern.

## Data and product invariants

Approved reference images in `apps/web/public/brand/references/` are **not** domain-data authority. Do not copy invented counts, prices, Gear SKUs, discounts, Gacha nav, or premature payment availability.

Canonical Button Presser supply remains Plate `officialExistingSupply` (62093).

Primary nav is `PRIMARY_NAV` in `apps/web/lib/nav.ts`: Market, Categories, Activity, Portfolio. Gacha is out of scope.

Brand mark: `NetVisionMark` / `NetVisionLogo`.

## Brand photography

Cinematic plates in `apps/web/public/brand/showroom/` are **environmental / background imagery**. They are allowed and encouraged on homepage, categories, and category heroes.

They must not replace canonical NFT media in asset cards, listing identity, portfolio holdings, or token ownership views.
