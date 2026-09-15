# Net Vision Basic Market Intelligence and Alerts Technical Specification
Version: 1.0
Workstream: P4
Branch: `feat/basic-intelligence`

## 1. Mission

Add useful descriptive intelligence without building a strategy engine.

Answer:
- What changed?
- What is this asset comparable to?
- Is this category moving?
- Did something I care about change?
- Is the underlying data fresh?

## 2. MVP Features

1. Comparable sales
2. Category context
3. Since You Were Here
4. Watchlist alerts
5. Listing-state alerts
6. Price-change alerts
7. New/high sale alerts
8. Freshness/confidence labels

## 3. Comparable Sales

Prefer deterministic explanations over opaque AI scoring.

Ranking:
1. strongest relevant facet overlap
2. same primary category
3. same collection
4. recency

Each comp explains why it was selected.

```ts
type ComparableSale = {
  saleId: string
  asset: AssetIdentity
  price: Money
  occurredAt: number
  matchedFacets: string[]
  matchBasis: string[]
  source: string
}
```

## 4. Category Intelligence

For each category/facet:
- floor
- listed count
- recent volume
- recent sales count
- high sale
- last sale
- coverage
- realtime feed health

Only show deltas when a valid historical baseline exists.

## 5. Since You Were Here

Use deterministic event summaries.

Examples:
- watched token repriced
- watched token listed
- watched token sold
- owned listing changed
- category floor moved
- new high sale

Never fabricate narrative when the event set is empty or incomplete.

## 6. Alert Rules

```ts
type AlertRule =
  | { type: 'TOKEN_LISTED'; asset: AssetIdentity }
  | { type: 'TOKEN_DELISTED'; asset: AssetIdentity }
  | { type: 'PRICE_BELOW'; asset: AssetIdentity; threshold: Money }
  | { type: 'PRICE_CHANGE'; asset: AssetIdentity; percent: number }
  | { type: 'CATEGORY_FLOOR_BELOW'; collectionId: string; facetSlug: string; threshold: Money }
  | { type: 'CATEGORY_NEW_HIGH_SALE'; collectionId: string; facetSlug: string }
```

MVP may be in-app only.

## 7. Freshness Semantics

Separate:
- market coverage
- realtime feed

Examples:
- `Indexed 99.4%`
- `Realtime feed: Live`
- `Updated 2m ago`
- `Partial`
- `Last known`
- `Unavailable`

Never use one "Live" badge for all concepts.

## 8. Data Quality Rules

Unknown != zero.

If floor is unavailable:
`Current floor unavailable`
`Last known: 1.69 USDG`

If comps are unavailable:
`No reliable comparable sales yet`

not fabricated fallback comps.

## 9. Service Boundary

```ts
interface MarketIntelligenceService {
  getComparableSales(asset: AssetIdentity): Promise<ComparableSale[]>

  getCategoryContext(input: {
    collectionId: string
    facetSlug: string
  }): Promise<CategoryContext>

  getChangesSince(input: {
    walletAddress?: string
    watchlist?: AssetIdentity[]
    since: number
  }): Promise<ChangeSummary>
}
```

The service consumes normalized data, not Button-specific classifier internals.

## 10. Collection Modularity

If collections weight facets differently, inject:

```ts
interface FacetImportanceProvider {
  weight(facet: AssetFacet): number
}
```

Button and Gear can provide different weights without changing the intelligence engine.

## 11. UI Components

- `ComparableSalesPanel`
- `CategoryContextBar`
- `SinceYouWereHere`
- `AlertCenter`
- `AlertRuleEditor`
- `FreshnessLabel`
- `DataConfidenceBanner`
- `MarketChangeChip`

## 12. Tests

### Unit
- comp ranking
- facet overlap
- alert thresholds
- dedupe
- time-windowing
- stale labeling
- unavailable vs zero

### Integration
- Button comps
- Gear comps
- partial sales history
- duplicate sale event
- changed listing
- category floor unavailable

### E2E
1. watch token
2. price changes
3. alert appears once
4. open token
5. comps explain basis
6. return later
7. Since You Were Here summarizes changes

## 13. Failure Simulations

- sales history unavailable
- delayed event
- duplicate event
- out-of-order event
- category membership changes
- missing baseline
- zero valid comps

## 14. Observability

Track:
- intelligence latency
- zero-comp responses
- alert rules evaluated
- alerts emitted
- dedupe hits
- partial/stale responses
- since-summary event counts

## 15. Acceptance Gate

`INTELLIGENCE PASS` requires:
- no strategy-engine creep
- every insight traces to data
- no false zero
- comps explain why
- alerts dedupe
- core works across Button and Gear
