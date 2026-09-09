# Branch Contract

Track ID: P1
Track type: Feature
Branch: `feat/portfolio-completion`
Owner: Portfolio agent
Base SHA: `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a`
Base authority epoch: E2
Target epoch compatibility: E2
Worktree: `/Users/immanuellewis/net-vision-wt-portfolio`
Spec: `docs/product/parallel-v1/01_PORTFOLIO_TECHNICAL_SPEC.md`

## Mission

Complete the existing Portfolio. Do not rebuild it.

Tabs: Inventory, Listed, Offers, Watchlist, Activity.

Make generic Portfolio code collection-aware:

```ts
{ ecosystemId, collectionId, tokenId }
```

Prove Button Presser #68 and NetNet Gear #68 cannot collide. Preserve Fletcher.

## Scope IN

- portfolio domain / repository / UI
- watchlist storage
- collection-aware asset identity in portfolio surfaces
- tests that #68 collision is impossible

## Scope OUT

- SQL read-model / writer / worker
- Buy Now / cart / checkout (Commerce)
- Gear metadata ingestion (Gear adapter; Portfolio only consumes identity)
- Intelligence alerts
- Visual rebuild of the marketplace

## Authority touched

None of the frozen E2 market authorities.

## Authorities consumed

- SQL listing state and token facts via `getMarketSource()` / existing APIs
- collection registry
- modularity identity contract

## Allowed paths

- `apps/web/lib/portfolio/**` (create)
- `apps/web/app/portfolio/**`
- watchlist modules under portfolio
- portfolio tests

## Shared paths requiring coordination

- `apps/web/lib/market/types.ts` — additive optional fields only, via orchestrator
- `packages/chain-config` — consume; Gear owns additive Gear collection

## Forbidden paths

See `docs/padp/AUTHORITY_MAP.md` frozen list. Also: `packages/transaction-policy`, commerce cart/checkout, Gear adapter internals.

## Proposed contract changes

Introduce / enforce `AssetIdentity` in generic portfolio lookups. No token-id-only maps.

## Dependencies

None. First product merge after PADP docs.

## Merge barrier

Closed until work is ready **and** this is the sole product PR onto staging. After merge: CI, E2E, cross-surface, Fletcher, manual smoke.

## Required tests

- identity collision: Button #68 ≠ Gear #68
- missing ownership ≠ empty confident inventory of zeros
- LISTED vs STALE vs UNKNOWN in Listed tab
- Fletcher-critical portfolio layout still renders

## Required failure simulations

- SQL source returns UNKNOWN for some tokens
- worker offline: do not wipe inventory; degrade honestly

## Observability

Portfolio queries should carry `collectionId` in logs/metrics, never tokenId alone.

## Rollback

Revert the Portfolio PR. Staging SQL authority unchanged.

## Evidence threshold

Tests + staging `/portfolio` smoke with a connected-wallet empty state and at least one fixture identity pair.

## Exit criteria

Five tabs exist or are honestly gated. Identity is collection-aware. No Button-only keys in generic portfolio code.

## Contract violation rule

If implementation requires a forbidden path or unowned authority change, STOP and escalate before modifying it.
