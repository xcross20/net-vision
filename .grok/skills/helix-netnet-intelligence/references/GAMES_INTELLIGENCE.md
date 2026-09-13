# Games Intelligence Reference

## Purpose

Define how Helix models NetNet games as economic systems. Games are not treated as a single category with one shared fee, payout or value-routing model.

## Canonical game identity

Every game record must include:
- `game_id`
- canonical name
- version/generation
- launch and retirement dates if known
- app/docs/source references
- contracts/addresses when verified
- input assets
- payout assets
- current status

Mechanics from one generation must not silently carry into another.

## Core economic ledger

Each round/session/product event should map observable value into separate buckets:

1. Gross player input.
2. Refunded or unresolved input.
3. Player payout / prize liability.
4. Venue fee.
5. Treasury remittance.
6. RWA Sleeve remittance.
7. Token burn.
8. Escrowed/player-owned assets.
9. Promotional subsidy.
10. Net venue economics when calculable.

Never report gross player input as revenue.

## Minimum game model

For every supported game answer:

### Mechanics
- What does the player provide?
- What determines the outcome?
- What does the player receive?
- Is inventory escrowed, burned, transferred or retained?
- What is the role of NET, USDG and stock tokens?

### Payout and EV
- payout table
- expected payout if calculable
- player EV
- house/venue EV
- variance / tail risk
- unresolved liabilities

### Value routing
Map where value actually goes:

`PLAYER -> GAME -> {PLAYER, TREASURY, RWA_SLEEVE, BURN, LP, OTHER}`

A burn is not revenue. A sleeve transfer is not automatically Core Treasury backing.

### Activity
Measure separately:
- entries / wagers / purchases
- active wallets/users when observable
- repeat usage when observable
- gross volume
- resolved rounds
- average input
- average payout
- total payouts
- fee revenue
- stock-token notional used
- NET bought/staked/burned if directly evidenced

### Revenue quality
Classify observed economics by sustainability:
- organic recurring
- launch/promotion-driven
- subsidy-dependent
- inventory-risk dependent
- market-making dependent
- one-time
- unknown

### Risks
Consider:
- randomness integrity
- custody/escrow
- smart contract
- oracle/feed
- inventory exposure
- liquidity
- payout insolvency
- market gaps
- regulatory constraints
- promotional dependence
- concentration

## Game comparison framework

Games can be compared across:
- user growth
- repeat activity
- gross activity
- net venue economics
- payout ratio
- capital efficiency
- NET demand contribution
- stock-token activity contribution
- treasury contribution
- sleeve contribution
- burn contribution
- risk

Do not rank games solely by gross volume.

## Game state classification

Use:
- DOCUMENTED_ONLY
- LIVE_OBSERVED
- LIVE_PARTIAL_EVIDENCE
- DEGRADED
- PAUSED
- RETIRED
- UNKNOWN

A public app page is not sufficient proof of current economic activity.

## Game-change alerts

Material events include:
- payout table or fee changed
- input asset changed
- contract/version changed
- new game launched
- activity materially deviates from baseline
- payout ratio materially changes
- unexpected treasury/sleeve routing
- unresolved liabilities grow
- randomness/oracle source changes
- product paused or unavailable

## Initial NetNet game catalog

The system should be able to represent, subject to current source verification:
- WinNET
- CLIMB
- Superstore
- COINflip
- SPACEX INVADERS
- Flight Simulator
- TURBO
- Blackjack
- The Button
- The Board Meeting

This list is a discovery seed, not a guarantee that every product is live or that names/mechanics remain unchanged.

## TURBO special handling

TURBO has a payoff structure closer to a house-written leveraged/knockout product than a simple casual game. Analyze:
- series/tier
- reference asset
- leverage
- knockout threshold
- player premium/value
- house inventory exposure
- realized player outcomes
- house payout liability
- turnover
- capital at risk
- realized house economics

Do not collapse TURBO economics into ordinary game volume.

## RW-Play analysis

Where a game uses tokenized equities, quantify separately:
- stock-token purchase/input notional
- stock-token held in escrow
- stock-token transferred to players
- stock-token retained by venue/sleeve
- stock-token sold/swapped
- associated NET activity

Then test the strategic claim that game activity creates sustainable stock-token and NET demand instead of assuming it.

## Game Intelligence Card

```yaml
game:
version:
status:
as_of:
input_assets:
gross_activity:
player_payouts:
venue_fees:
net_venue_economics:
treasury_flow:
sleeve_flow:
burn:
player_ev:
venue_ev:
activity_trend:
revenue_quality:
primary_risks:
confidence:
evidence:
```

Unknown values stay unknown.