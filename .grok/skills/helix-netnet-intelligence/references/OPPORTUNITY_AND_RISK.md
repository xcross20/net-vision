# Opportunity and Risk Reference

## Purpose

Define how Helix turns heterogeneous NetNet products and strategies into comparable decision support without pretending everything is the same kind of return.

## Opportunity classes

Use distinct classes:
- CASHFLOW / LENDING
- STAKING / YIELD TOKEN
- FIXED-MATURITY
- LIQUIDITY PROVISION
- MARKET MAKING
- GAME / HOUSE-RISK
- NFT / COLLECTIBLE
- TOKEN SPOT EXPOSURE
- ROUTING / EXECUTION SAVINGS
- OTHER

Do not compare an NFT collectible and a lending vault using a single APY score.

## Common dimensions

Where meaningful, measure:
- expected net economics
- realized historical economics
- downside magnitude
- probability / scenario uncertainty
- liquidity
- capacity
- duration or maturity
- leverage
- collateralization
- complexity
- smart-contract risk
- oracle/feed risk
- market risk
- operational dependency
- concentration
- execution cost
- tax/accounting considerations only if explicitly modeled and sourced

## Baseline

Every recommendation requires a relevant baseline, such as:
- hold USDG
- hold NET
- stake NET
- do nothing / WAIT

The baseline must match the user's objective and numeraire.

## Return units

Never report an unlabeled return.

Possible units:
- USD return
- NET-denominated return
- token quantity growth
- simple annualized yield
- APY
- realized P&L
- expected fee capture
- discount to maturity

Do not translate token-denominated yield into fixed USD return without modeling token price.

## Strategy decomposition checklist

For every strategy determine:
- capital source
- owned capital
- borrowed capital
- collateral
- leverage
- fees earned
- incentives
- financing cost
- trading cost
- rebalancing cost
- expected loss sources
- liquidity/capacity
- exit path
- invalidation conditions

## LP / market-making model

At minimum, expected net economics should consider:

`fees captured - borrow cost - rebalance cost - adverse selection - execution cost - realized inventory loss/gain`

Inputs should include:
- venue
- pair
- fee tier
- volume
- active liquidity
- expected share
- range width
- time in range
- volatility
- feed/oracle cadence
- competition
- capital size

Historical venue volume alone is not a forecast.

## Credit / lending model

Consider:
- deposit APR/APY
- utilization
- borrower concentration
- collateral assets
- LTV / liquidation parameters
- oracle risk
- liquidity
- withdrawal availability
- bad-debt risk
- manager/performance fees
- incentive dependency

## Pendle model

Keep separate:
- SY exposure
- PT principal claim
- YT future-yield claim
- LP exposure
- maturity
- implied yield
- current sNET conversion/index
- liquidity
- exit before maturity

Fixed NET-denominated return is not fixed USD return.

## RWA strategy analysis

For stock-token strategies consider:
- underlying equity volatility
- token market liquidity
- issuer/custody constraints
- market-hours vs token-hours mismatch
- stale-feed risk
- Monday/opening gap risk
- corporate actions
- borrowing cost
- collateral liquidation risk
- pool depth
- execution competition

Published base/bear/bull scenarios remain MODEL_ASSUMPTION until observed.

## Risk taxonomy

Minimum risk factors:
- market
- liquidity
- smart contract
- oracle/feed
- counterparty/custody
- collateral/liquidation
- leverage
- concentration
- maturity/lock
- execution/slippage
- operational/keeper
- governance
- stablecoin
- tokenized-asset issuer
- regulatory/product availability
- model uncertainty
- data quality

## Risk score policy

Early versions should use transparent qualitative tiers:
- LOW
- LOW_MEDIUM
- MEDIUM
- MEDIUM_HIGH
- HIGH

Each tier must list drivers. Do not hide complexity behind one number.

## Opportunity score

An early interpretable ranking may use:

`expected_edge × evidence_confidence × liquidity_factor × capacity_factor - risk_penalties - concentration_penalty - complexity_penalty`

Rules:
- version the scoring model
- show major contributing factors
- never let a high return completely cancel a catastrophic risk flag
- allow hard exclusions
- validate rankings against outcome history

## Hard exclusion examples

Potential `NOT_ELIGIBLE` conditions:
- unresolved contract identity
- stale critical oracle/input
- no safe exit/liquidity
- capacity below user size
- route unavailable
- unsupported jurisdiction/product state if known
- strategy deployment unverified
- transaction policy cannot validate planned action

## Invalidation conditions

Every opportunity thesis should have explicit invalidation conditions.

Examples:
- borrow APR rises above fee yield
- pool liquidity falls below threshold
- token discount closes
- utilization reaches unsafe level
- volatility exceeds modeled range
- feed age exceeds threshold
- game payout mechanics change
- strategy contract/version changes

Monitoring should prefer invalidation alerts over generic price spam.

## WAIT

`WAIT` is appropriate when:
- no opportunity beats baseline after risk/cost adjustment
- evidence is stale or incomplete
- capacity is insufficient
- user concentration is already too high
- execution cost consumes expected edge
- the strategy cannot be safely exited

The product should optimize decision quality, not transaction count.