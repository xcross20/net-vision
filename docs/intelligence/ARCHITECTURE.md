# Helix NetNet Intelligence Architecture

## Purpose

This document defines the target architecture for the Net Vision / Helix intelligence layer. It is intentionally broader than the launch MVP and should guide later development without forcing premature implementation.

## System boundaries

The architecture separates five concerns that must not collapse into one service:

1. Knowledge: relatively stable mechanics, identities, definitions and historical claims.
2. Observation: fresh mutable state from chain, markets, games, APIs and documents.
3. Analysis: deterministic and model-assisted derivations from evidence.
4. Personalization: private wallet/user context applied after public evidence collection.
5. Action: routing, simulation and later automation under independent policy controls.

## High-level topology

```text
                    PUBLIC SOURCES
 docs / RPC / APIs / explorers / venues / games / announcements
                           |
                           v
                 +------------------+
                 | Source Adapters  |
                 +------------------+
                           |
                           v
                 +------------------+
                 | Evidence Ledger  |
                 +------------------+
                     |           |
                     v           v
              Knowledge Graph   Time Series
                     |           |
                     +-----+-----+
                           v
                 Derived Analytics
                           |
                           v
                 Opportunity Engine
                           |
            +--------------+--------------+
            |                             |
            v                             v
      Public Intelligence          Private Portfolio Layer
            |                             |
            +--------------+--------------+
                           v
                    Recommendation
                           |
                     Outcome Memory
                           |
                           v
                       Calibration

Optional action path:
Recommendation -> User intent -> Execution Router -> Transaction Policy
               -> Simulation -> User signature -> Receipt -> Reconciliation

Later:
User policy -> Automation Policy Engine -> same Execution Router
```

## Component responsibilities

### 1. Source Registry

Stores known public sources and their semantics.

Fields:
- source_id
- source_type
- canonical_url or chain-qualified endpoint
- owner/publisher
- officiality classification
- domains covered
- freshness expectation
- parser/adaptor
- access mode
- last successful observation
- last failure
- trust notes

The source registry does not establish truth by itself. Officiality is one evidence dimension.

### 2. Evidence Ledger

Append-only evidence records. Raw evidence should be retained when licensing and storage policy allow.

Suggested record:

```ts
interface EvidenceRecord {
  evidenceId: string
  sourceId: string
  retrievedAt: string
  effectiveAt?: string
  chainId?: number
  blockNumber?: bigint
  entityRefs: string[]
  claimClass?: ClaimClass
  contentHash: string
  parserVersion: string
  payloadRef?: string
  qualityFlags: string[]
}
```

Rules:
- never replace a previous observation because a new one disagrees
- record conflicts
- normalize after capture
- retain parser/model version
- use effective time separately from retrieval time

### 3. Knowledge Graph

Stores semantic facts and relationships.

Suggested tables / collections:

`entities`
- id
- type
- canonical_name
- status
- metadata

`entity_aliases`
- entity_id
- alias
- source

`relations`
- subject_id
- predicate
- object_id
- valid_from
- valid_to
- evidence_id
- confidence

`claims`
- claim_id
- subject_id
- predicate
- value
- units
- claim_class
- status
- evidence_id
- observed_at
- effective_at
- confidence

Important: product/version generation must be modeled explicitly. A newer game or contract must not silently inherit mechanics from an older version.

### 4. Observation Store

Mutable facts should be stored as time-series observations, not overwritten singletons.

Potential observation families:
- asset_price
- pool_liquidity
- pool_volume
- borrow_rate
- utilization
- treasury_balance
- token_supply
- backing_rfv
- sleeve_asset
- sleeve_debt
- nft_floor
- nft_listing
- nft_sale
- strategy_position
- game_volume
- game_payout
- game_fee
- game_burn
- game_rwa_flow
- protocol_capacity
- oracle_age
- route_quote

Every observation requires units and scope.

### 5. Accounting Engine

A dedicated accounting component prevents category errors.

Ledger scopes should include:
- Core Treasury
- RWA Sleeve
- user/player escrow
- LP inventory
- collateral
- debt
- prize liability
- protocol fee revenue
- manager fee revenue
- burn
- issuance
- staking/temporary float reduction

Rules:
- borrowed USDG is not revenue
- gross assets are not net equity
- escrow is not owned treasury capital
- burn is not cash revenue
- volume is not profit
- sleeve assets are not Core RFV unless governance/mechanics explicitly change

### 6. Analytics Engine

Prefer deterministic calculations where possible.

Examples:
- backing per NET
- utilization
- realized LP fee yield
- borrow carry
- liquidity depth
- NFT segment premium
- game payout ratio
- venue net revenue estimate
- strategy realized return
- capacity utilization
- concentration
- route execution cost

LLMs should explain and reconcile, not secretly calculate foundational accounting when deterministic code can do it.

### 7. Strategy Registry

Strategies are versioned definitions.

```ts
interface StrategyDefinition {
  strategyId: string
  version: string
  name: string
  owner?: string
  assets: string[]
  venues: string[]
  capitalModel: string
  feeModel: string
  riskFactors: string[]
  requiredInputs: string[]
  evaluationHorizons: string[]
  evidenceRefs: string[]
}
```

A strategy registry allows the system to track the difference between a published thesis, an observed deployment, and a realized result.

### 8. Opportunity Engine

The opportunity engine converts heterogeneous strategies into a common decision schema.

```ts
interface OpportunitySnapshot {
  opportunityId: string
  asOf: string
  expectedNetReturn?: number
  returnUnit?: string
  horizon?: string
  confidence: ConfidenceState
  liquidityScore?: number
  capacity?: number
  riskTier: string
  complexityTier: string
  assetExposure: string[]
  invalidationConditions: string[]
  evidenceSetId: string
  modelVersion: string
}
```

The engine should support comparative ranking without forcing all opportunities into a false single APY.

### 9. Game Intelligence Engine

Maintain one adapter and one semantic model per game/version.

Game observation schema should support:
- entries/wagers/purchases
- input asset
- payout liability
- resolved payout
- fees
- burn
- treasury remittance
- sleeve remittance
- stock-token flow
- escrow balance
- players/unique wallets when publicly measurable
- session/round identity
- randomness source

Derived metrics:
- gross activity
- net venue economics
- payout ratio
- average entry
- active users
- repeat activity if measurable
- capital efficiency
- promotional dependence
- NET demand/float effect
- RWA flow effect

Never compare games using gross activity alone.

### 10. Event / Change Detection

Create domain-specific materiality rules.

Examples:
- NET backing changes > configured threshold
- borrow rate changes enough to alter strategy rank
- pool depth falls below minimum safe capacity
- a strategy invalidation condition becomes true
- a game launches or changes payout mechanics
- game activity deviates materially from baseline
- new Gear collection metadata or utility appears
- NFT floor breaks by X%
- a contract generation changes

Change events feed monitoring and alerts.

### 11. Private Portfolio Layer

Wallet data is a separate privacy boundary.

Suggested normalized positions:
- asset
- protocol/product
- amount
- cost basis confidence
- liquidity
- lock/maturity
- collateral/debt role
- NFT collection/token

Public market research should run without attaching wallet identifiers. Personalization occurs after public observations are available.

### 12. Recommendation Store

Store recommendations as immutable decision records.

Fields:
- recommendation_id
- user/wallet opaque ref when applicable
- created_at
- eligible opportunity set
- rankings
- explanation
- input evidence set
- model versions
- confidence
- constraints
- invalidation conditions
- benchmark

This is necessary for honest postmortems.

### 13. Outcome Store

Outcome evaluation should be scheduled by horizon.

Store:
- recommendation_id
- horizon
- evaluated_at
- realized return or outcome
- benchmark
- max adverse excursion if relevant
- liquidity events
- risk events
- invalidation triggered
- forecast error
- attribution

### 14. Model Registry

Every score or forecast should be versioned.

Examples:
- opportunity_score_v1
- lp_net_yield_v2
- game_revenue_quality_v1
- confidence_calibration_v3

Historical recommendations must remain reproducible against the model version used at the time.

## Data freshness contract

Every derived output declares dependencies and max ages.

Example:

```ts
const PT_SNET_REQUIRED_INPUTS = {
  ptPrice: '5m',
  sNetIndex: '5m',
  maturity: 'versioned',
  poolLiquidity: '5m',
  netSpot: '5m'
}
```

If one required input exceeds the allowable age, the result becomes `STALE` or `INSUFFICIENT_EVIDENCE` rather than silently continuing.

## Confidence model

Early implementation should use discrete states:

- HIGH
- MEDIUM
- LOW
- INSUFFICIENT_EVIDENCE
- CONFLICTED

Inputs:
- source quality
- source agreement
- freshness
- observation completeness
- model validation
- historical sample size
- unresolved assumptions

Later versions may add calibrated numeric probability or prediction intervals only after empirical validation.

## API boundaries

Suggested future application interfaces:

```ts
getEntity(entityId)
getCurrentState(entityId)
getEvidence(claimId)
getChanges(domain, since)
getStrategySnapshot(strategyId)
compareOpportunities(input)
getGameSnapshot(gameId)
getGameEconomics(gameId, horizon)
getPortfolioIntelligence(walletRef)
getRecommendation(input)
getRecommendationPostmortem(recommendationId)
```

Execution APIs remain separate:

```ts
quoteAction(actionIntent)
validateAction(actionPlan)
simulateAction(actionPlan)
prepareAction(actionPlan)
```

## Storage recommendation

Use Postgres as the primary normalized state store initially.

Suggested future additions only when justified:
- TimescaleDB extension or dedicated time-series store for high-volume observations
- object storage for immutable raw evidence
- graph projection/materialized relation tables rather than an early graph database
- vector index for semantic retrieval of documents, not as canonical truth

Avoid premature infrastructure complexity.

## Reliability requirements

- ingestion idempotency
- source-specific retries
- no global refresh that blanks state
- last-known-good state with freshness labels
- append-only raw observations
- provenance through derivations
- per-source health
- derived metric dependency health
- replayable ingestion
- audit trail of model/version changes

## Security requirements

- read-only research workers have no signing capability
- secrets scoped by adapter
- wallet/private context isolated from public crawlers
- execution router has explicit contract/asset/chain allowlists
- no arbitrary calldata from language-model output
- policy engine deterministic and independently tested
- user approval boundary before any execution unless a later explicit automation policy applies

## Build principle

Do not begin with a generalized autonomous financial platform.

Build the narrowest production-shaped vertical slice that proves the compounding data moat:

one NetNet domain -> fresh observations -> deterministic analytics -> evidence-backed intelligence card -> stored recommendation -> later outcome evaluation.

Then expand domain coverage.