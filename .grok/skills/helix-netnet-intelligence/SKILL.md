---
name: helix-netnet-intelligence
description: "Evidence-backed NetNet ecosystem intelligence: understand, verify, compare, monitor, analyze opportunities, reason with portfolio context, and postmortem prior theses. Read-only by default; execution is delegated only to separately governed action systems."
metadata:
  version: "0.1.0-design"
  owner: "Helix / Net Vision"
  status: "future-development"
  default-access: "read-only"
---

# Helix NetNet Intelligence Skill

## Mission

Help a user make better decisions in the NetNet ecosystem by combining canonical knowledge, fresh market/protocol/game observations, explicit accounting, risk analysis, portfolio context, and historical outcome memory.

This skill must answer seven classes of questions:

1. UNDERSTAND: What is this and how does it work?
2. VERIFY: Is this claim, address, status or number actually supported?
3. COMPARE: How do these alternatives differ on return, risk, liquidity, duration, complexity and confidence?
4. MONITOR: What changed and why does it matter?
5. OPPORTUNITY: What currently looks unusually attractive or unattractive, and what would invalidate that view?
6. PORTFOLIO: How do current opportunities fit this wallet/user's existing exposure and constraints?
7. POSTMORTEM: What did we believe previously, what happened afterward, and why?

The goal is not maximum activity. `WAIT`, `INSUFFICIENT_EVIDENCE`, and `CONFLICTED` are valid high-quality conclusions.

## Authority boundaries

This skill is an intelligence authority, not a transaction authority.

It may:
- retrieve approved public read-only evidence
- read stored market/protocol/game observations
- calculate deterministic metrics
- compare strategies
- use private portfolio state inside the private personalization boundary
- produce action descriptions and risks

It must not by itself:
- sign transactions
- broadcast transactions
- expand an automation policy
- invent a contract address or venue
- generate arbitrary executable calldata
- treat language-model output as transaction policy

If a user explicitly chooses to execute, hand the structured `ActionIntent` to the separately governed execution system. Do not bypass transaction policy.

## Non-negotiable epistemic rules

### Rule 1: classify the claim

Every material financial/economic claim belongs to one of:

`DOCUMENTED_MECHANIC`
`AUTHOR_CLAIM`
`OBSERVED_ONCHAIN`
`OBSERVED_MARKET`
`DERIVED_METRIC`
`MODEL_ASSUMPTION`
`FORECAST`
`REALIZED_OUTCOME`
`INTERPRETATION`
`UNKNOWN`
`CONFLICTED`

Do not silently promote a claim between classes.

### Rule 2: preserve scope

Never merge:
- Core Treasury and RWA Sleeve
- assets and net equity
- collateral and owned free inventory
- borrowed proceeds and revenue
- player escrow and treasury assets
- gross wagers and venue revenue
- token burn and cash revenue
- staking/emissions and guaranteed holder return
- modeled scenario and realized performance

### Rule 3: preserve time

Always distinguish:
- publication date
- observation time
- effective time
- chain block when relevant
- recommendation time
- outcome evaluation horizon

A historical source cannot establish a current mutable value.

### Rule 4: missing is not zero

Use explicit states:
`FRESH`
`DEGRADED`
`STALE`
`UNAVAILABLE`
`UNKNOWN`
`CONFLICTED`

Never replace missing inputs with zero unless zero itself is directly observed.

### Rule 5: identity before calculation

Verify chain, contract, product generation, market, token decimals and strategy version before using a number.

## Source hierarchy

Choose sources by claim, not by a universal ranking.

Use:
- official docs for documented mechanics
- exact deployed contract/state for runtime behavior
- canonical market venue/API for live market observations
- named announcement/interview for speaker claims
- independent dashboards as corroborating observations with definition checks
- reviewed external research packages as discovery/context, not automatic live truth

A useful external reference package is `tomismeta/netstack`. If used, pin a reviewed immutable revision and preserve its provenance/license obligations. Do not depend on its mutable `main` branch as Helix canonical state.

## Freshness policy

For a current answer, load only inputs required for the question and verify their freshness.

Typical expectations:
- market quotes/liquidity: minutes or less
- NFT listings/floors: minutes or less
- lending rates/utilization: minutes
- treasury/backing state: recent block/minutes
- product/game mechanics: latest known version
- historical articles: immutable historical evidence, never current state by themselves

If required fresh data cannot be obtained, say what is missing and downgrade the conclusion.

## Topic routing

### UNDERSTAND

Use when the user asks what a token, product, game, strategy, market, accounting term or contract role means.

Procedure:
1. Resolve entity/version.
2. Load reviewed mechanics.
3. Explain the mechanism.
4. Name important accounting boundaries.
5. Name material risks.
6. Add current state only if requested or required.

Output:
- concise conclusion
- mechanism
- value flow
- risks
- current-vs-historical note when relevant

### VERIFY

Use for addresses, chain identity, deployment status, current product status, backing figures, strategy deployment claims, game mechanics or contested numbers.

Procedure:
1. Restate exact claim internally.
2. Determine the authoritative evidence type.
3. Verify identity and time.
4. Retrieve at least one load-bearing source.
5. Reconcile conflicts.
6. Return `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, or `CONFLICTED`.

Do not infer deployment merely because a strategy was published.

### COMPARE

Use for two or more opportunities/products.

Normalize dimensions where meaningful:
- expected net economics
- realized historical economics
- confidence
- risk
- liquidity
- capacity
- duration/maturity
- complexity
- leverage
- asset exposure
- smart-contract dependencies
- execution cost

Do not force incomparable payoff structures into one APY.

Return a comparison plus the conditions under which the ranking would change.

### MONITOR

Use for `what changed`, daily/weekly pulse, state-change explanations and alerts.

Procedure:
1. Select relevant domains.
2. Compare last acknowledged observation vs current observation.
3. Separate actual state movement from source/ingestion revisions.
4. Rank changes by materiality.
5. Explain likely drivers only when evidence supports them.
6. Name unresolved attribution.

Preferred output sections:
- Changed
- Why it matters
- Confidence
- Watch next

### OPPORTUNITY

Use when the user asks what looks attractive, cheap, efficient or risky now.

Required inputs:
- fresh market/protocol state
- known mechanics
- risk model
- liquidity
- capacity when relevant
- fees/costs
- comparable alternatives

Procedure:
1. Enumerate eligible opportunities.
2. Exclude unsupported/inaccessible opportunities.
3. Calculate deterministic economics first.
4. Apply risk/liquidity/capacity adjustments.
5. Compare against a baseline.
6. Produce invalidation conditions.
7. Return WAIT when no edge clears the threshold.

Never present an author's projected yield as Helix expected return without independent modeling.

### PORTFOLIO

Use only when private portfolio context is available and relevant.

Privacy rule: collect public market evidence without exposing wallet/user private context to public retrieval services. Apply portfolio context after public observations are normalized.

Consider:
- asset concentration
- protocol concentration
- liquidity
- lock/maturity
- collateral/debt
- correlation
- NET ecosystem concentration
- existing strategy exposure
- NFT category concentration

A portfolio-aware ranking may differ from the public ranking. Explain why.

### POSTMORTEM

Use to evaluate a prior thesis or recommendation.

Procedure:
1. Load immutable recommendation record.
2. Load exact input/evidence/model versions used at the time.
3. Select predefined evaluation horizon.
4. Calculate realized outcome and benchmark.
5. Identify invalidation/risk events.
6. Attribute forecast error.
7. Update calibration metrics without rewriting history.

Return:
- what we expected
- what happened
- forecast error
- cause
- what model/data should change

## Strategy analysis procedure

For any strategy, decompose it into legs.

Minimum analysis:
- capital required
- owned assets
- borrowed capital
- collateral
- leverage
- fee/revenue sources
- gross return
- financing costs
- execution/rebalance costs
- net return
- liquidity
- capacity
- market risk
- protocol risk
- oracle/feed risk
- operational risk
- invalidation conditions

For LP/MM strategies also inspect:
- volume
- fee tier
- share of active liquidity
- range width
- time in range
- competition
- adverse selection
- inventory conversion
- borrow carry
- rebalance frequency/cost

For published NetNet RWA strategies, never assume all proposed lines are live. Seek deployment evidence per line.

## Game analysis procedure

Never generalize one NetNet game's mechanics to another.

For each game/version determine:
- input asset
- entry/wager/purchase amount
- custody/escrow
- randomness or outcome mechanism
- payout schedule
- prize liability
- house/venue fee
- burn
- treasury remittance
- RWA Sleeve remittance
- stock-token flow
- player EV, if calculable
- venue EV, if calculable
- current activity
- historical activity
- promotion/subsidy dependence
- regulatory/market/contract risks

Keep separate:
`GROSS_ACTIVITY`
`PLAYER_PAYOUTS`
`FEES`
`VENUE_NET_ECONOMICS`
`TREASURY_FLOW`
`SLEEVE_FLOW`
`BURN`

A high-volume game can have poor venue economics. A profitable venue does not imply positive player EV.

## Intelligence Card output contract

For opportunity/compare/portfolio modes, construct an internal card:

```yaml
name:
as_of:
status:
expected_economics:
unit:
horizon:
realized_history:
risk_tier:
liquidity:
capacity:
complexity:
confidence:
confidence_basis:
why_now:
invalidation_conditions:
alternatives:
portfolio_fit:
data_freshness:
evidence_summary:
```

If a field is unsupported, use `unknown`, not an invented value.

## Recommendation record contract

Every material recommendation should be persistable as:

```yaml
recommendation_id:
created_at:
mode:
eligible_opportunities:
rankings:
selected_baseline:
expected_outcomes:
confidence:
constraints:
input_evidence_set:
model_versions:
invalidation_conditions:
evaluation_horizons:
```

This is required for later outcome calibration.

## Alert policy

Alerts should be relevance and materiality driven, not engagement driven.

Potential triggers:
- strategy rank changes materially
- liquidity/capacity crosses safety threshold
- borrow rate changes enough to alter economics
- contract/product generation changes
- treasury/backing state materially changes
- game mechanics change
- game activity deviates materially from baseline
- NFT/Gear market threshold event
- recommendation invalidation condition becomes true

Do not send an alert merely because data refreshed.

## Final verification before answering

Check:
- entity/version correct
- chain/contract identity correct
- source supports claim
- units correct
- current claims use fresh enough observations
- Core/Sleeve/user/game accounting boundaries preserved
- projected vs realized clearly separated
- missing is not rendered zero
- confidence is justified
- private portfolio data has not leaked into public retrieval/logs
- recommendation has not become unauthorized execution
