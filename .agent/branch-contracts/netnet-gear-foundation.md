# Branch Contract

Track ID: P3
Track type: Adapter
Branch: `feat/netnet-gear-foundation`
Owner: Gear agent
Base SHA: `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a`
Base authority epoch: E2
Target epoch compatibility: E2
Worktree: `/Users/immanuellewis/net-vision-wt-gear`
Spec: `docs/product/parallel-v1/03_NETNET_GEAR_TECHNICAL_SPEC.md`

## Mission

Prove multi-collection architecture with **read-only** NetNet Gear.

First: collection registration, real metadata, real imagery, facets, token detail, market browsing, portfolio ownership.

Only actual Gear metadata. No invented mockup assets. No Gear commerce until collection-specific transaction policy is proven.

## Scope IN

- Gear collection definition (`netnet-gear`)
- Gear adapter / facet extraction from real metadata
- Gear fixtures from real tokens
- read-only token detail + browsing + portfolio consumption of Gear identity

## Scope OUT

- Gear buy/sell/offers
- Button Presser SQL writer / supply / contract changes
- Invented traits (Slot, Supply, Tier, etc. only if present in real metadata)

## Authority touched

Collection registry (additive). Gear-only facet rows.

## Authorities consumed

- E2 SQL market engine for Button; Gear may have no listings yet — show honest empty/unknown
- Portfolio identity contract

## Allowed paths

- `apps/web/lib/collections/netnet-gear/**` (create)
- additive `packages/chain-config` Gear collection
- Gear fixtures
- Gear-specific UI routes if isolated

## Shared paths requiring coordination

- token route `/tokens/[id]` must not assume Button-only; coordinate with Portfolio identity
- taxonomy package: Gear facets stay in Gear adapter, not Button taxonomy

## Forbidden paths

Frozen E2 list. Button `officialExistingSupply`. Commerce execution. Fake catalog.

## Proposed contract changes

Register `netnet-gear` collection. Canonical id `netnet-gear:<tokenId>` / `{ ecosystemId, collectionId, tokenId }`.

## Dependencies

Rebase after Commerce merge (or after Portfolio if commerce delay is approved). Default queue: after P2.

## Merge barrier

Closed until previous queue item staging PASS. BLOCK if Gear tokens collide with Button tokenIds in any generic map.

## Required tests

- Button #68 and Gear #68 distinct
- facets only from real metadata fixtures
- missing metadata ≠ fabricated trait
- commerce CTA absent or gated for Gear

## Required failure simulations

- metadata fetch fail → unknown, not zero items pretending to be complete
- Gear collection with no listings → not Button floors

## Observability

Log collectionId on Gear reads.

## Rollback

Revert Gear PR. Button SQL authority unchanged.

## Evidence threshold

One real Gear NFT: correct metadata, facets, token view, portfolio identity.

## Exit criteria

Read-only Gear path works. No Gear commerce.

## Contract violation rule

If implementation requires a forbidden path or unowned authority change, STOP and escalate before modifying it.
