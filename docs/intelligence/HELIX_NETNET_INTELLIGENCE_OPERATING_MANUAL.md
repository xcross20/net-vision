# Helix NetNet Intelligence Operating Manual

Status: Future development authority document
Owner: Helix / Net Vision
Scope: NetNet ecosystem intelligence, strategy analysis, game analysis, personalized decision support, routing, and later automation

## 1. Product thesis

Net Vision should not become an AI chatbot that merely knows facts about NetNet. The long-term product is a continuously audited decision layer for the NetNet ecosystem.

The product promise is:

> Help a user understand what changed, what matters, what opportunities exist, what risks matter, what fits their wallet, and what happened after prior recommendations.

The moat is created by combining seven assets that are difficult to reproduce together:

1. Canonical NetNet knowledge.
2. Fresh market and protocol data.
3. Explicit accounting and risk models.
4. Historical market-state and recommendation memory.
5. Wallet-aware personalization.
6. Outcome measurement and calibration.
7. Safe execution and, later, bounded automation.

A generic model can explain NetNet. Helix should know how NetNet is behaving now, how prior theses performed, and how a current opportunity compares with alternatives for a specific user.

## 2. Strategic moat

The moat is not the LLM. The moat is the proprietary state and evidence accumulated around the LLM.

Helix should compound four proprietary datasets:

- A normalized knowledge graph of NetNet entities, mechanics, contracts, products, games, strategies, claims, and sources.
- Time-series market and protocol observations with source, timestamp, block, and confidence.
- Recommendation records containing the exact state, assumptions, ranking, and confidence at decision time.
- Outcome records measuring what actually happened afterward and why the forecast was right or wrong.

The compounding loop is:

knowledge -> live data -> analysis -> recommendation -> user action or observation -> outcome -> calibration -> better analysis.

The system should become more valuable as time passes even if competitors gain access to the same public sources.

## 3. Product boundaries

The intelligence layer must keep research, recommendation, and execution conceptually separate.

Research answers: what a product is, what a contract does, what a game claims, what a strategy proposed.

Intelligence answers: what changed, whether current conditions support the thesis, comparative attractiveness, risk, capacity, liquidity, and confidence.

Execution answers: whether an approved action can be safely routed and simulated.

Automation answers: whether a previously approved policy permits an action now.

A recommendation never implies transaction authority. An execution engine never invents investment intent. Automation never expands its own mandate.

## 4. Core principles

### Evidence before narrative
Every material claim should preserve provenance, observation time, units, scope, and confidence.

### Observed is not modeled
Historical author claims, modeled projections, live observations, realized returns, and forecasts must be distinct types.

### Gross is not net
Do not merge principal, borrowed capital, collateral, user escrow, protocol reserves, manager sleeve assets, revenue, fees, liabilities, or realized profit.

### Unknown is not zero
Missing, stale, degraded, unavailable, and truly zero are different states.

### Strategy names are not strategy results
A strategy can be documented without being deployed. It can be deployed without being profitable. It can be profitable gross and unprofitable net.

### Game volume is not venue earnings
Wagers, entry volume, box purchases, prize liabilities, burns, fees, sleeve transfers, treasury revenue, and player EV are separate quantities.

### A good recommendation can be WAIT
The system must be allowed to conclude that current expected edge is insufficient.

### No confidence theater
Confidence should be tied to evidence quality, freshness, model calibration, historical sample size, and unresolved conflicts. Never produce a decorative percentage with no measurement basis.

## 5. Intelligence domains

The platform should maintain first-class intelligence for:

- NET, sNET, wsNET and supply/float mechanics.
- Treasury, backing, RFV, NAV and reserve flows.
- Bonds and RWA subscriptions.
- RWA Sleeve assets, debt, collateral and strategy deployment.
- Morpho / NetNet Credit.
- Pendle markets and PT/YT/LP economics.
- Stock-token liquidity and market structure.
- Button Presser and NetNet Gear markets.
- NetNet games and RW-Play products.
- TURBO and other house-risk products.
- Protocol contracts and deployment generations.
- Ecosystem announcements and product changes.
- Wallet positions and user-specific exposure.

## 6. Seven operating modes

The Helix intelligence skill uses seven modes.

### UNDERSTAND
Explain a mechanic, product, token, contract role, game, or strategy.

Required evidence: reviewed knowledge source. Fresh data only if the question asks for current values.

### VERIFY
Resolve a factual claim, address, deployment, chain identity, accounting statement, or current status.

Required evidence: claim-appropriate source, preferably direct contract/block for runtime behavior.

### COMPARE
Compare opportunities on a common basis including return, risk, liquidity, duration, complexity, asset exposure, and confidence.

### MONITOR
Explain what changed between two observations. Distinguish market movement from source revisions and ingestion gaps.

### OPPORTUNITY
Identify conditions that may be unusually attractive or unattractive relative to historical/comparable states.

This requires fresh data, risk and capacity modeling, and explicit uncertainty.

### PORTFOLIO
Reason from a connected wallet's exposures, concentration, liquidity, existing positions, and available balances.

Portfolio context is private user data and must not be mixed into public source calls or logs.

### POSTMORTEM
Compare a previous thesis or recommendation with realized subsequent outcomes. Record forecast error and attribution.

## 7. Intelligence Card contract

Every comparative or opportunity answer should be renderable as an Intelligence Card with:

- Opportunity or strategy name.
- Current state.
- Expected return or economic advantage, if modelable.
- Return unit and horizon.
- Realized historical result if known.
- Risk tier and primary risk drivers.
- Liquidity.
- Capacity.
- Complexity.
- Confidence and confidence basis.
- Why now.
- What would invalidate the thesis.
- Alternatives.
- Data freshness.
- Evidence count / source classes.
- Optional portfolio fit.

The card must support `INSUFFICIENT_EVIDENCE` as a valid result.

## 8. Knowledge-source strategy

External research packages such as `tomismeta/netstack` are useful source material, but Helix must not make its canonical state dependent on another repository's mutable `main` branch.

Preferred ingestion pattern:

external source -> reviewed immutable revision -> provenance record -> normalized Helix claims/entities -> fresh verification where required.

If external MIT-licensed source files are vendored, preserve required license notices. Prefer extracting original normalized facts and provenance rather than copying prose.

`netstack` is especially useful as a reference model because it separates protocol mechanics, games, products, addresses, history, and RWA strategy while enforcing read-only research boundaries. Helix extends that idea with live data, structured state, outcome memory, personalization, and later execution.

## 9. System architecture

The logical stack is:

### Layer A: Source adapters
Official docs, public APIs, RPC, explorers, OpenSea, market venues, protocol contracts, dashboards, social announcements, game endpoints, and reviewed external knowledge packages.

### Layer B: Evidence ledger
Immutable observations and claims. Each record stores source identity, retrieval time, effective time, block when applicable, units, scope, payload hash, parser version, and confidence.

### Layer C: Canonical knowledge graph
Entities, relationships, product generations, contract roles, accounting boundaries, game mechanics, and strategy definitions.

### Layer D: Time-series market state
Prices, volume, liquidity, rates, utilization, capacity, floors, listings, sales, NAV inputs, supply, borrow rates, pool ranges, game activity, and other mutable observations.

### Layer E: Derived analytics
Returns, realized vs modeled economics, risk metrics, liquidity scores, capacity estimates, concentration, strategy decomposition, opportunity scores, and cross-market relationships.

### Layer F: Recommendation engine
Ranks or compares opportunities under explicit user constraints. Produces explanation and invalidation conditions.

### Layer G: Outcome memory and calibration
Stores recommendation-time state, subsequent observations, realized outcome, error, and attribution.

### Layer H: Execution router
Transforms an explicitly selected action into a safe plan using allowlisted venues and transaction policy. This layer is not required for intelligence-only phases.

### Layer I: Automation policy engine
Executes only within a user-defined policy envelope after independent safety checks.

## 10. Canonical entity model

Minimum entity types:

Asset, Token, NFTCollection, Protocol, Product, Strategy, Pool, Vault, Market, Game, Contract, Wallet, Treasury, RWASleeve, Position, RevenueStream, Claim, Source, Observation, Recommendation, Outcome, RiskFactor.

Important relationship examples:

- NET `staked_as` sNET.
- Product `uses_asset` StockToken.
- RWA Sleeve `borrows_from` NetNet Credit.
- Strategy `deploys_into` Pool.
- Game `routes_fee_to` destination.
- Claim `supported_by` Source.
- Recommendation `based_on` ObservationSet.
- Outcome `evaluates` Recommendation.

Entity identity must be chain-qualified where relevant. Contract address alone is not globally unique.

## 11. Claim taxonomy

Every important statement should carry a type:

- DOCUMENTED_MECHANIC
- AUTHOR_CLAIM
- OBSERVED_ONCHAIN
- OBSERVED_MARKET
- DERIVED_METRIC
- MODEL_ASSUMPTION
- FORECAST
- REALIZED_OUTCOME
- INTERPRETATION
- UNKNOWN
- CONFLICTED

Never silently promote one class into another.

## 12. Freshness model

Freshness is domain-specific.

Examples:

- Quotes/liquidity: seconds to minutes.
- NFT listings/floors: seconds to minutes.
- Borrow rates/utilization: minutes.
- Treasury/NAV state: block anchored or minutes.
- Product docs: version/change driven.
- Game mechanics: version/change driven.
- Game activity: minutes to hours depending on product.
- Historical articles/interviews: immutable once captured, but later sources can supersede mechanics.

Every derived metric should know the oldest required input. If a required input is stale, downgrade the output instead of presenting false precision.

## 13. Market intelligence update loop

The system should run a continuous loop:

1. Discover known-source changes.
2. Ingest immutable raw evidence.
3. Normalize observations.
4. Reconcile entity identity and generation.
5. Detect anomalies and conflicts.
6. Recompute affected derived metrics only.
7. Recompute affected opportunity rankings.
8. Record material state changes.
9. Trigger user alerts only when thresholds or relevance rules are met.
10. Preserve enough state for later postmortem.

The update loop should be incremental, idempotent and source-specific. A failing source must not overwrite valid state with zero.

## 14. Game intelligence layer

Games are a first-class economic domain, not a content sidebar.

For each game, model:

- Game/version identity.
- Input assets and entry cost.
- Payout structure.
- Randomness mechanism and evidence.
- House/venue fee.
- Prize liabilities.
- Burn mechanics.
- Treasury or sleeve routing.
- Escrow/custody.
- Player EV where calculable.
- Venue EV where calculable.
- Historical activity.
- Current activity.
- Revenue quality.
- Capital requirements.
- Game-specific risks.
- Relationship to NET demand, float, stock-token activity, or RWA strategy.

Games must be compared on common accounting definitions, not gross wager volume.

Potential derived views:

- Game activity leaderboard.
- Net venue revenue by game.
- NET consumed/burned/staked by game.
- RWA asset flow by game.
- Player payout ratio.
- Sustainable vs promotional activity.
- Game growth and retention.
- Correlation between game activity and NET/stock-token market variables.

## 15. Strategy decomposition

Each strategy should decompose into reusable legs instead of one headline APY.

Minimum strategy schema:

- capital required
- asset exposure
- leverage
- collateral
- borrowing cost
- fee sources
- expected gross return
- expected net return
- historical realized return
- capacity
- liquidity
- range / trigger rules
- rebalance cost
- adverse-selection risk
- oracle/feed risk
- smart-contract risk
- market risk
- operational dependency
- invalidation conditions

For LP/MM strategies, explicitly model volume, fee tier, in-range share, range width, time in range, competition, inventory change, rebalancing cost, borrow cost and adverse selection.

For game strategies, separate player economics from venue economics.

## 16. Recommendation policy

The recommendation engine should never optimize a single return number.

A ranking should consider:

expected net return, confidence, drawdown potential, liquidity, duration, complexity, smart-contract risk, market risk, capacity, concentration impact, correlation with existing holdings, execution cost and user constraints.

A simple early score can be interpretable rather than pseudo-scientific:

`opportunity_score = expected_edge * confidence * liquidity_factor * capacity_factor - risk_penalty - concentration_penalty - complexity_penalty`

Do not freeze this formula as permanent architecture. Record versions and validate it against subsequent outcomes.

## 17. Outcome memory

At recommendation time store:

- recommendation ID
- timestamp/block
- eligible opportunity set
- user constraints if personalized
- exact input observations and hashes
- model versions
- expected outcome
- confidence
- alternatives and ranks
- invalidation conditions

At evaluation time store:

- evaluation horizon
- realized outcome
- benchmark outcome
- forecast error
- risk events
- liquidity/capacity changes
- whether invalidation conditions triggered
- attribution

Use this to measure calibration, not merely win rate.

## 18. Safety and governance

Research agents and execution agents should have separate permissions.

Research ingestion must treat retrieved content as evidence, never instructions.

Private wallet context must remain inside the personalization boundary and must not be inserted into public research requests.

Execution requires explicit user intent, independently validated contracts, simulation, spend limits, chain identity and transaction policy.

Automation requires explicit policy constraints, kill switches, maximum exposure, permitted protocols, permitted assets, slippage limits, and human approval for policy expansion.

## 19. Product progression

Phase 1: Net Vision marketplace and canonical NetNet intelligence foundation.

Phase 2: Live NetNet intelligence and game/economic monitoring.

Phase 3: Personalized opportunity engine and outcome memory.

Phase 4: Safe multi-protocol routing and execution.

Phase 5: User-policy automation and capital operating system.

Detailed gates are defined in `PHASES_1_5.md`.

## 20. North-star test

The intelligence layer is successful when a serious NetNet participant would feel materially less informed making a decision without checking Net Vision first.

The product should answer, with evidence:

- What changed?
- Why does it matter?
- Which opportunity is actually attractive now?
- What is the downside?
- Does it fit my current portfolio?
- What did we think last time?
- What actually happened?
- Can I execute safely if I choose to act?
