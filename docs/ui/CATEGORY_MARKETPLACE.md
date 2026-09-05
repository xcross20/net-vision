# Category marketplace UI

`/categories/:slug` is the market for that category. There is no “Open Market” hop to buy.

## Shell

Every category — Brass, 3 Digit, Palindromes, Years — is an instance of the same shell:

```text
CategoryHero
CategoryMetrics
CategoryTabs          Listings | Sales | Offers | Analytics
CategoryListings      default
CategorySales
CategoryOffers
CategoryAnalytics
SelectionBar          sticky, existing cart
SweepDrawer           cheapest N / spend cap / max per item; gated on live coverage
```

Do not hard-code per-slug pages.

## Directory `/categories`

Title: **Categories**

Family filters: All, Number, Material, Pattern, Culture

Columns: Category, Floor, 24h, 7d, Volume 24h, Sales, Listed

Sort: Trending, Highest Volume, Most Sales, Floor Gain, Lowest Supply, Highest Sale

Incomplete coverage: floor cell is `Syncing`, never a silent `0`.

## Category hero metrics

Show a value only when coverage supports it. Otherwise `Syncing` or `—`.

Floor, Best Offer, Listed / Members, Owners, 24h/7d/30d volume, 24h/7d sales, highest recorded sale, floor change 24h/7d/30d, market coverage.

History caption: `Tracked since <date>`.

## Listings tab

Cards are existing + member + LISTED. Filters inside a category: price, material, secondary pattern, marketplace, token number, listed age. Intersection is AND (`3 Digit` + `Brass` + `Palindrome`).

Each listed card is selectable (`+` / `✓`). Selection feeds `CartProvider`. Sticky bar:

Desktop: `N selected` · subtotal · Clear · Add to Cart · Buy N
Mobile: `N selected · subtotal` · Cart · Buy N

Buy N adds the selection to the existing cart and opens it. No second checkout.

## Sweep

Button: `Sweep {category name}`. Disabled while `marketStatus === 'syncing'` and while Value Sweep / quality strategies remain frozen.

Preview returns an exact basket. Confirm calls `cart.addMany`. Checkout is the existing cart pipeline.

## Sales / Offers / Analytics

Sales: 24h / 7d / 30d / All tracked, volume, count, average, median, highest sale, recent sales, top sales. Highest sale links to the token.

Offers: top item offers, count, aggregate value. No category-wide bids.

Analytics: floor sparkline from persisted snapshots, volume, sales velocity, listed percentage, owners, price distribution. No fabricated history.

## Portfolio

`/portfolio`: Inventory, Listed, Offers, Watchlist, Activity. Inventory includes unlisted owned NFTs. List / Edit / Cancel use the OpenSea listing surface until native listing exists. Category filters reuse the facet engine.

## Trending

Deterministic score from volume acceleration, sales acceleration, floor movement, offer growth, listing velocity. Floor-up alone is not “trending”. Component inputs are stored so the score can be explained.
