# Net Vision Shared Modularity Code Contract
Version: 1.0
Applies to all current and future feature work

## 1. Purpose

Preserve future portability without turning Net Vision into a generic-platform rewrite.

Rule:

> Build NET-first product behavior, but keep reusable infrastructure free of avoidable Button Presser assumptions.

## 2. Dependency Direction

Allowed:

```text
generic core
    ^
    |
collection adapter
    ^
    |
NET product
```

Forbidden:

```text
generic core
    |
    v
Button-specific classifier
```

## 3. Core Concepts

Generic code should use:
- ecosystem
- collection
- asset identity
- facet
- market state
- sale
- ownership
- order
- transaction policy
- intelligence event

Collection-specific code supplies:
- metadata interpretation
- facet extraction
- display formatting
- collection config
- facet importance
- relationships
- supply/discovery policy

## 4. Asset Identity

```ts
type AssetIdentity = {
  ecosystemId: string
  collectionId: string
  tokenId: string
}
```

No generic API, cache, React key, state map, or repository lookup may use token ID alone.

## 5. Collection Registry

Near-term static registry is sufficient.

```ts
type CollectionDefinition = {
  ecosystemId: string
  collectionId: string
  slug: string
  name: string
  chainId: number
  contractAddress: string
  tokenStandard: string
  marketplaceSources: string[]
}
```

Do not build tenant/admin infrastructure.

## 6. Adapter Contract

```ts
interface CollectionAdapter {
  definition: CollectionDefinition
  normalizeMetadata(raw: unknown): NormalizedAssetMetadata
  classifyFacets(metadata: NormalizedAssetMetadata): AssetFacet[]
  display(asset: NormalizedAsset): AssetDisplay
  validate(metadata: NormalizedAssetMetadata): ValidationResult
}
```

Optional:
- `FacetImportanceProvider`
- `RelationshipProvider`
- `SupplyDiscoveryPolicy`

## 7. Supply Discovery

Generic core must not assume:
- token IDs start at 1
- IDs are contiguous
- token IDs are numeric
- max token ID equals supply
- all token IDs in a range exist

Button Presser's discovery envelope and verified existing universe remain collection policy.

## 8. Market State

Canonical generic state:
- UNKNOWN
- LISTED
- UNLISTED_VERIFIED
- STALE

Do not invent collection-specific market states inside the generic market engine.

## 9. Facets

Generic facet type:

```ts
type AssetFacet = {
  family: string
  slug: string
  label: string
  source: 'metadata' | 'derived' | 'curated' | 'game'
  sourceVersion: string
  metadata?: Record<string, unknown>
}
```

Button-specific classification belongs in Button adapter/provider.
Gear-specific classification belongs in Gear adapter/provider.

## 10. Market Repositories

Preferred signatures:

```ts
getCollectionSnapshot(collectionId)
getCategoryMetrics(collectionId, facetSlug)
listCategoryListings(collectionId, facetSlug)
getToken(collectionId, tokenId)
recentSales(collectionId)
```

Avoid:
- `getButtonPresserSnapshot()`
- `getBrassListings()` in generic layers

## 11. Portfolio

Portfolio consumes normalized assets.

No portfolio code should import:
- palindrome classifier
- Plate mapping
- Gear trait parser

## 12. Commerce

Commerce receives collection and chain context explicitly.

No universal permissive allowlist.

Policy scope:
- ecosystem
- collection
- chain
- target
- payment token
- action

## 13. Intelligence

Intelligence consumes normalized:
- facets
- sales
- market state
- watchlist
- ownership

Collection-specific facet weighting is injected.

## 14. Folder Guidance

Do not force a large directory refactor now.

But new code should trend toward boundaries such as:

```text
lib/
  market/
  portfolio/
  commerce/
  intelligence/
  collections/
    button-presser/
    netnet-gear/
```

The exact names are less important than dependency direction.

## 15. Architecture Tests

Add a test that fails if generic layers import collection-specific modules.

Example policy:

```text
generic modules may not import paths containing:
collections/button-presser
collections/netnet-gear
```

Adapters may import generic modules.

## 16. Configuration Rules

Do not globally hardcode:
- Robinhood chain
- Button contract
- USDG by symbol
- Button supply
- OpenSea slug

These may remain configured defaults for the current deployment but must enter reusable services through config/context.

## 17. Observability Labels

Metrics for multi-collection-capable systems should include:
- ecosystemId
- collectionId
- operation
- source

Avoid unlabeled aggregate metrics when collection-specific diagnosis matters.

## 18. Modularity Review Checklist

For every PR ask:
1. Is token ID being treated as globally unique?
2. Is Button-specific logic entering a generic layer?
3. Is chain context implicit?
4. Is collection context implicit?
5. Is payment-token identity symbol-only?
6. Is a collection-specific facet hardcoded into reusable UI?
7. Could Gear use this code without modification?
8. Could a future collection with non-contiguous IDs use this code?
9. Did modularity weaken execution security?
10. Did we create a second source of truth?

Any "yes" to 1-6 or 9-10 requires revision.

## 19. Non-Goals

Do not build now:
- generic SaaS tenancy
- plugin marketplace
- fully dynamic ecosystem onboarding
- customer admin portal
- billing
- generic protocol strategy engine
- cross-chain abstraction everywhere

Only preserve seams needed to avoid a future rewrite.

## 20. Acceptance Gate

`MODULARITY PASS` requires:
- explicit collection context in new shared features
- composite identities
- no generic->collection-specific imports
- collection-specific metadata behind adapters
- transaction security remains tightly scoped
- Gear can reuse market/portfolio/intelligence primitives
