# Net Vision Portfolio Technical Specification
Version: 1.0
Workstream: P1
Branch: `feat/portfolio-completion`

## 1. Mission

Portfolio answers:
- What do I own?
- What is listed?
- What offers are relevant?
- What am I watching?
- What changed?

It must be collection-aware from the start so Button Presser and NetNet Gear can coexist without duplicated architecture.

## 2. MVP Tabs

1. Inventory
2. Listed
3. Offers
4. Watchlist
5. Activity

## 3. Domain Model

```ts
type AssetIdentity = {
  ecosystemId: string
  collectionId: string
  tokenId: string
}

type PortfolioAsset = {
  identity: AssetIdentity
  collectionName: string
  displayName: string
  imageUrl: string | null

  ownership: {
    ownerAddress: string | null
    verifiedAt: number | null
    status: 'VERIFIED' | 'STALE' | 'UNKNOWN'
  }

  market: {
    listingState: 'UNKNOWN' | 'LISTED' | 'UNLISTED_VERIFIED' | 'STALE'
    price: number | null
    currency: string | null
    orderHash: string | null
    seller: string | null
    lastVerifiedAt: number | null
  }

  facets: AssetFacet[]
}
```

## 4. Repository Boundary

```ts
interface PortfolioRepository {
  getOwnedAssets(input: {
    walletAddress: string
    collectionIds?: string[]
  }): Promise<PortfolioAsset[]>

  getWalletActivity(input: {
    walletAddress: string
    cursor?: string
    limit?: number
  }): Promise<PortfolioActivityPage>
}
```

UI must not care whether data is blob-backed or SQL-backed.

## 5. Ownership Authority

Use an explicit hierarchy:
1. authoritative current ownership source
2. recently verified indexed ownership
3. stale indexed ownership
4. unknown

Never show "Owned" if the system only has stale evidence.

## 6. Inventory Rules

- include unlisted assets
- include collection identity
- show listing state
- show market freshness
- show facets
- allow collection filter
- do not suppress assets because market metadata is unavailable

## 7. Listed Tab

An asset belongs here only if:
- the connected wallet is current owner
- listing state is `LISTED`
- listing has a current order snapshot

Seller alone is insufficient if owner state is stale.

## 8. Offers Tab

Read-only MVP.

Show:
- token
- collection
- offer amount
- currency
- offerer
- expiration
- source
- freshness

Do not add Accept Offer execution here.

## 9. Watchlist

MVP may be local-first.

```ts
type WatchlistEntry = {
  collectionId: string
  tokenId: string
  addedAt: number
}
```

Requirements:
- versioned local schema
- composite identity
- no duplicates
- safe recovery from corrupted storage
- future server sync should not require UI redesign

## 10. Activity

Supported event types:
- acquired
- transferred out
- listed
- delisted
- sold
- offer received
- watched asset repriced

Only emit events backed by actual data.

## 11. API Contract

Recommended:

`GET /api/v1/portfolio/:wallet`

Response:

```json
{
  "wallet": "0x...",
  "generatedAt": 0,
  "assets": [],
  "coverage": {
    "status": "complete|partial|unavailable",
    "message": null
  }
}
```

Never return a false-empty successful portfolio if upstream ownership lookup failed.

## 12. UI Components

- `PortfolioShell`
- `PortfolioSummary`
- `PortfolioTabs`
- `PortfolioAssetGrid`
- `PortfolioAssetCard`
- `PortfolioAssetRow`
- `PortfolioCollectionFilter`
- `PortfolioStateBadge`
- `PortfolioPartialDataBanner`
- `PortfolioActivityFeed`

Generic components accept normalized asset data only.

## 13. Cross-Collection Proof

Must support:
- Button Presser #68
- NetNet Gear #68

simultaneously.

React/data keys:
- `button-presser:68`
- `netnet-gear:68`

Never `68`.

## 14. Required UI States

- wallet disconnected
- loading
- no supported assets
- partial ownership data
- upstream unavailable
- stale ownership
- stale market state
- listed
- unlisted verified
- listing changed
- wallet changed mid-session

## 15. Tests

### Unit
- composite identity
- wallet normalization
- tab filters
- listed subset correctness
- watchlist dedupe
- stale ownership
- local schema migration

### Integration
- Button-only wallet
- Gear-only wallet
- mixed wallet
- same token ID in two collections
- partial upstream failure
- listing state changes after load

### E2E
1. connect
2. inventory loads
3. listed tab matches market state
4. open asset
5. add watchlist
6. refresh
7. watchlist persists
8. market state refreshes correctly

## 16. Failure Simulations

- ownership timeout
- one collection unavailable
- account changes mid-request
- malformed image/metadata
- previously non-empty portfolio returns temporary empty result

No failure may silently render "you own nothing."

## 17. Observability

Track:
- portfolio request success/failure
- ownership lookup latency
- assets per collection
- partial responses
- stale ownership count
- unsupported collection count

## 18. Acceptance Gate

`PORTFOLIO PASS` requires:
- mixed-collection identity correctness
- no false empty states
- listed tab correctness
- watchlist stability
- mobile and desktop E2E green
- generic components contain no Button Presser classifier imports
