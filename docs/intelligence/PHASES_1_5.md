# Helix NetNet Intelligence: Phase 1 to Phase 5

This roadmap defines the intended development sequence. Each phase should deliver a coherent product capability and a proprietary data asset. Do not skip gates merely because later phases are more exciting.

## Phase 1: Canonical intelligence foundation

### Objective
Turn Net Vision from a marketplace with ad hoc analytics into a structured NetNet knowledge and observation system.

### User value
A user can ask what a NetNet product, strategy, game, token, market, or metric means and receive an answer with explicit provenance, dates, accounting boundaries, and freshness.

### Scope

Build:
- Source registry.
- Evidence ledger.
- Canonical entity model.
- Claim taxonomy.
- Contract and chain identity registry.
- NetNet knowledge ingestion workflow.
- First read-only intelligence skill.
- Freshness/conflict semantics.
- Current Button Presser market intelligence as the first live domain.
- Basic NetNet ecosystem change feed.

Seed domains:
- NET / sNET / wsNET.
- Treasury / backing / supply.
- Button Presser.
- NetNet Gear identity and metadata when available.
- Credit.
- Pendle.
- RWA Sleeve concepts.
- documented games directory and mechanics.

### External knowledge
Use reviewed sources such as official NetNet documentation and selected pinned revisions of independent research packages like `tomismeta/netstack`. External prose is not canonical truth. Normalize claims and preserve provenance.

### First vertical slice

Button Presser should prove the pattern:

source -> evidence -> normalized market state -> derived category intelligence -> freshness -> user explanation.

### Interfaces

- `/intelligence`
- entity intelligence drawer/page
- `What changed?`
- source/evidence inspection
- intelligence cards on category pages

### Exit gate

PHASE 1 PASS requires:
- no important intelligence claim without source/time classification
- canonical identity across chain/contracts/products
- stale/unknown/conflicted are distinct
- read-only skill answers are reproducible from stored evidence
- at least one live market domain updates continuously
- game directory stores versioned mechanics instead of generic summaries

### Moat asset created
A proprietary normalized NetNet knowledge graph plus historical evidence ledger.

---

## Phase 2: Live ecosystem and game intelligence

### Objective
Continuously observe the economic state of NetNet and explain material changes.

### User value
A user opens Net Vision and sees what changed across NET, treasury, markets, games, credit, RWA products, and NFTs without manually reading multiple dashboards and announcements.

### Scope

Build live adapters for the highest-value observable domains:
- NET market and supply state.
- sNET/wsNET indexes and staking state.
- treasury/backing inputs.
- Credit rates/utilization/capacity.
- Pendle market state.
- supported stock-token market liquidity.
- NFT floors/listings/sales.
- game activity and economics where public evidence permits.
- announcements and documented mechanic changes.

Build change detection:
- state diffs
- materiality thresholds
- anomaly detection
- source conflicts
- deployment/version changes

Build the Game Intelligence Engine.

### Game intelligence deliverable
For every supported game/version maintain:
- entry asset/cost
- payout model
- fee structure
- burn
- prize liability
- escrow/custody
- randomness mechanism
- treasury/sleeve routing
- stock-token use
- player EV when calculable
- venue EV when calculable
- current activity
- historical activity
- revenue quality
- major risks

Initial game catalog should be extensible to documented products such as WinNET, CLIMB, Superstore, COINflip, SPACEX INVADERS, Flight Simulator, TURBO, Blackjack, The Button, and The Board Meeting, without assuming they share the same mechanics.

### User surfaces

`Since you were here`
- material changes only
- grouped by market, protocol, games, NFTs and treasury

`Games`
- activity
- payout/fee mechanics
- venue economics
- player economics
- RWA flows
- freshness

`NetNet Pulse`
- top ecosystem changes
- risk changes
- unusual activity
- new/changed products

### Alert examples

- Credit borrow rate materially changes.
- New strategy deployment is observed on-chain.
- Game payout mechanics change.
- Game activity spikes but net venue economics do not.
- RWA stock-token flow materially changes.
- Treasury/backing changes.
- Button/Gear category floor breaks.

### Exit gate

PHASE 2 PASS requires:
- source-health monitoring
- incremental/idempotent ingestion
- current-vs-historical separation
- game volume never represented as revenue by default
- at least three economic domains can produce trustworthy change summaries
- at least three games have versioned economic models with evidence
- change feed can explain why a state changed or explicitly say attribution is unknown

### Moat asset created
A proprietary time-series record of NetNet economic and game state.

---

## Phase 3: Personalized opportunity engine and outcome memory

### Objective
Move from describing the ecosystem to helping a user make better decisions.

### User value
The system compares available opportunities under the user's actual portfolio, constraints, liquidity needs and risk tolerance.

### Scope

Build:
- Strategy Registry.
- Opportunity common schema.
- deterministic strategy calculators.
- risk factor library.
- portfolio normalization.
- recommendation store.
- outcome store.
- postmortem/calibration pipeline.

Initial comparable opportunities may include, only when currently supported by evidence:
- hold NET
- stake NET / hold sNET
- Pendle PT/YT/LP structures
- NetNet Credit
- selected NET liquidity positions
- selected stock-token liquidity strategies
- TURBO exposure where analysis is appropriate
- NFT/collectible opportunities as a separate non-yield category

Do not force games, NFTs and lending into a single APY ranking when their payoff structures differ.

### Portfolio intelligence

For a wallet, derive:
- asset concentration
- NET ecosystem concentration
- liquid vs locked
- collateral and debt
- maturity exposure
- smart-contract concentration
- protocol concentration
- NFT category exposure
- game-related positions if observable

Private wallet data must not be included in public-source retrieval requests.

### Recommendation behavior

Recommendations must show:
- why the opportunity ranks where it does
- expected edge and unit/horizon
- confidence basis
- liquidity
- capacity
- risk drivers
- portfolio fit
- alternatives
- invalidation conditions
- WAIT when edge is insufficient

### Outcome memory

Every recommendation becomes an experiment.

Store what the engine knew, what it predicted and what happened later. Evaluate multiple horizons. Measure calibration and forecast error rather than cherry-picked wins.

### Exit gate

PHASE 3 PASS requires:
- personalized and non-personalized comparisons produce explainable differences
- recommendation inputs are reproducible
- no decorative confidence percentages
- at least two strategy models have historical/out-of-sample outcome evaluation
- recommendation postmortems run automatically at defined horizons
- WAIT is a tested output
- portfolio data privacy boundary has explicit tests

### Moat asset created
A proprietary history of decisions, market states, recommendations and realized outcomes.

---

## Phase 4: Safe routing and execution

### Objective
Own execution intent after earning trust at the decision layer.

### User value
After choosing an opportunity, the user can execute from Net Vision without reconstructing routes manually.

### Scope

Build:
- Action Intent schema.
- execution quote service.
- route comparison.
- allowlisted venue registry.
- transaction-plan compiler.
- deterministic transaction policy.
- simulation.
- user-readable execution preview.
- receipt and reconciliation.
- failure recovery.

Potential supported actions should be added one at a time:
- NFT checkout via canonical settlement
- multi-asset payment routing into USDG
- staking/unstaking if approved
- Pendle interactions
- Credit deposit/withdraw
- approved swaps
- approved LP actions

Do not add an action solely because an LLM knows how it works.

### Architecture rule

Intelligence proposes. User selects. Router plans. Policy validates. Simulator proves. Wallet signs. Reconciliation observes.

No language-model-generated arbitrary calldata.

### Route intelligence

The router should compare:
- expected output
- slippage
- fees
- gas
- liquidity
- route complexity
- approval requirements
- failure/recovery properties

A recommendation may identify an opportunity without there being a safe executable route.

### Exit gate

PHASE 4 PASS requires for each action class:
- chain/contract identity authority
- explicit asset allowlists
- route allowlists
- quote expiry
- max input / min output
- simulation
- user-readable semantics
- receipt proof
- reconciliation
- negative/adversarial transaction-policy tests
- independent kill switch
- controlled live low-value E2E evidence

### Moat asset created
Execution-flow data and the ability to convert decision intent into safely routed capital flow.

---

## Phase 5: Bounded automation and capital operating system

### Objective
Allow recurring actions within explicit user policies while preserving user control and auditability.

### User value
The system can monitor conditions and perform approved recurring actions without requiring the user to manually rebuild the same decision every time.

### Examples

Possible future policies:
- alert only when an opportunity score crosses a threshold
- rebalance only inside a predefined allocation band
- roll a mature position into one of a small allowlisted set
- maintain a user-approved liquidity range under explicit limits
- route incoming USDG under a fixed allocation policy

These are examples, not launch commitments.

### Automation policy model

A policy must specify:
- allowed assets
- allowed protocols
- allowed action types
- max per-action amount
- max daily/weekly exposure
- minimum expected edge
- risk ceiling
- slippage ceiling
- gas/fee ceiling
- cooldown
- stop conditions
- expiry
- notification requirements
- human approval requirements

The automation system may tighten a policy for safety but may never broaden it without explicit user approval.

### Required safety mechanisms

- kill switch
- per-policy state machine
- deterministic policy evaluation
- independent transaction policy
- simulation
- idempotency
- replay protection
- exposure accounting
- failure recovery
- audit log
- anomaly alerts
- policy expiry
- human override

### Learning boundary

Outcome learning may improve forecasts and rankings. It may not silently change user authorization limits.

Model updates and policy updates are different authority domains.

### Exit gate

PHASE 5 PASS requires:
- shadow-mode operation first
- simulation-only period
- bounded low-value pilot
- deterministic policy tests
- chaos/failure testing
- full auditability
- no autonomous authority expansion
- safe shutdown under upstream degradation
- post-action reconciliation proving actual state

### Moat asset created
Recurring capital-flow relationships, proprietary execution/outcome history and high switching costs built on trust rather than lock-in.

---

# Cross-phase governance

## Every phase must preserve

- provenance
- accounting boundaries
- versioned contracts/products/games
- unknown/stale/conflicted states
- privacy separation
- recommendation/action authority separation
- reproducibility
- observable failures

## Development sequencing

Do not mix an authority change with broad feature work.

Preferred cycle:

1. define invariant
2. establish source/authority
3. build vertical slice
4. prove data correctness
5. prove failure behavior
6. expose UX
7. collect outcomes
8. expand coverage

## North-star progression

Phase 1: `What is this?`

Phase 2: `What changed?`

Phase 3: `What should I consider and why?`

Phase 4: `Execute the option I selected safely.`

Phase 5: `Continue doing this inside the policy I approved.`
