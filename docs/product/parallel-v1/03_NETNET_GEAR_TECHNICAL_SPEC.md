# NetNet Gear Multi-Collection Technical Specification
Version: 1.0
Workstream: P3
Branch: `feat/netnet-gear-foundation`

## 1. Mission

Use Gear as the second NET collection proof.

The target architecture is:

```text
same market engine
same portfolio
same activity model
same commerce framework
different collection adapter
```

## 2. Known Metadata Concepts

- Slot
- Supply
- Tier
- Table
- Wearable By
- Earned By Presser
- Edition

Do not invent missing semantics.

## 3. Identity

```ts
const NETNET_GEAR_COLLECTION_ID = 'netnet-gear'
```

Canonical asset ID:
`netnet-gear:<tokenId>`

## 4. Adapter Contract

```ts
interface CollectionAdapter {
  collectionId: string
  ecosystemId: string

  normalizeMetadata(raw: unknown): NormalizedAssetMetadata
  classifyFacets(input: NormalizedAssetMetadata): AssetFacet[]
  display(input: NormalizedAssetMetadata): AssetDisplay
  validate(input: NormalizedAssetMetadata): ValidationResult
}
```

## 5. Facet Mapping

Candidate mappings require semantic validation:

- Slot -> `equipment` or `slot`
- Tier -> `rarity`
- Table -> `game` or dedicated family
- Wearable By -> `character` only if that is truly its meaning
- Edition -> `edition` if "season" would be incorrect
- Earned By Presser -> relationship rather than plain facet

Do not force Gear into Button-specific categories.

## 6. Relationships

Recommended:

```ts
type AssetRelationship = {
  sourceAsset: AssetIdentity
  targetAsset: AssetIdentity
  type: 'EARNED_BY' | 'WEARABLE_BY' | 'RELATED_TO'
  source: 'metadata' | 'derived' | 'curated' | 'game'
  sourceVersion: string
  metadata?: Record<string, unknown>
}
```

Example:
`Gear #X -> EARNED_BY -> Button Presser #Y`

If a database table is added later, make it generic:
`asset_relationships`

not `gear_presser_links`.

## 7. Metadata Normalization

Requirements:
- preserve raw metadata
- preserve original trait labels
- case-insensitive trait normalization
- deterministic slugging
- preserve unknown traits
- no crash on duplicate traits
- no guessed enum values

Unknown values produce an anomaly or safe passthrough.

## 8. Rollout

### G1
Fixtures and adapter tests only.

### G2
Read-only live metadata probe.

Verify:
- collection identity
- contract
- OpenSea slug
- token identity
- trait semantics

### G3
Register collection and ingest read-only:
- tokens
- metadata
- facets
- market state
- sales

### G4
Portfolio support.

### G5
Commerce only after Gear transaction-policy validation.

## 9. SQL Expectations

Reuse:
- tokens
- token_facets
- token_market_state
- sales
- market_events

Do not create Gear-specific duplicates of generic market tables.

## 10. Category Market

Gear facets should feed the same category-market UI.

Generic market provides:
- floor
- listed count
- listings
- sales
- volume

Adapter supplies:
- category/facet labels
- collection-specific display semantics

## 11. Portfolio

Gear appears in the same Portfolio.

Requirements:
- collection filter
- generic asset cards
- Gear facets
- no Gear-only portfolio route required
- cross-collection relationship links where supported

## 12. Fixtures

Required:
- complete metadata
- missing optional trait
- unknown Tier
- unknown Slot
- duplicate trait
- multiple Wearable By values
- Earned By Presser
- missing image
- malformed field
- future unknown trait

## 13. Modularity Tests

Prove:
- no Button number classifier
- no Plate extraction for Gear
- no numeric range inference
- Button #68 and Gear #68 coexist
- generic market renders Gear
- generic portfolio renders Gear

## 14. Failure Simulations

- conflicting metadata
- metadata disappears
- listing before metadata
- duplicate event
- relationship points to missing Button
- metadata changes after ingest

## 15. Observability

Per-collection metrics:
- tokens discovered
- metadata verified
- metadata anomalies
- facets generated
- relationships generated
- listed count
- stream events
- reconciliations
- stale states

## 16. Acceptance Gate

`GEAR FOUNDATION PASS` requires:
- verified identity
- fixtures green
- no Button-specific dependency
- same-token collision test green
- generic market and portfolio compatibility
- no invented metadata semantics
