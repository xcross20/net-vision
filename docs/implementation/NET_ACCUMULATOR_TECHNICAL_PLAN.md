# NET Accumulator — Technical Implementation Plan

**Status:** implementation specification for coding agent  
**Product:** Net Vision  
**Scope:** read-only strategy intelligence first; no Pendle; no autonomous execution in initial phases  
**Primary strategy:** conservative Haunted-style NET accumulation using sNET/wsNET collateral, Loopback/Morpho USDG borrowing, and deterministic Spot NET vs Real World Bond routing  
**Initial policy target:** 10% LTV

---

## 0. Agent operating instructions

Before writing code, read:

- `docs/agent/OPERATING_MANUAL.md`
- `docs/agent/PRODUCT_INVARIANTS.md`
- `docs/agent/RELEASE_GATES.md`
- existing `packages/transaction-policy/**`
- current wallet/connectivity implementation under `apps/web`
- current Railway/service topology

This is a **financial-state and future wallet-execution feature**. Treat it as P0-sensitive even while read-only.

Required agent workflow:

1. Run Scope & Architecture Guard before coding.
2. Establish source-of-truth and freshness semantics for every financial number.
3. Implement the smallest read-only vertical slice first.
4. Add unit/contract/failure-mode tests at the same time as implementation.
5. Run Market Data Integrity, Cross-Surface Product Consistency, Production Failure-Mode, API Contract, and Release Readiness audits for read-only work.
6. Before any transaction preparation is enabled, also run Wallet Transaction Security, Dependency/Supply-Chain Security, and User Journey E2E audits.
7. **Never** interpret a transaction hash as success; receipt confirmation is required.
8. No strategy code may silently change policy parameters.
9. No automatic execution is permitted until a later explicit release gate.

---

# 1. Product objective

Build a NET strategy module inside Net Vision that answers, continuously and deterministically:

> Given this wallet's current sNET/wsNET position and USDG debt, is a conservative re-loop available under the user's fixed risk policy, and if so, is Spot NET or the Real World Bond the better safe acquisition route?

The module begins as a **shadow/simulation and alerting engine**. It must prove that the strategy would have improved the wallet's debt-adjusted NET position before any execution feature is considered.

The feature is intentionally narrow.

### In scope

- NET / sNET / wsNET balances and conversion state
- Loopback / Morpho wsNET collateral position
- USDG debt and borrow rate
- current LTV and liquidation-distance metrics
- a 10% target-LTV Haunted-style strategy
- re-arm threshold below target LTV
- Spot NET effective acquisition quote
- Real World Bond effective acquisition quote
- deterministic Spot-vs-Bond route selection
- bond availability/discount/capacity watcher
- strategy alerts
- shadow-account simulation
- debt-adjusted performance attribution
- future transaction-plan preparation behind an independent disabled flag

### Explicitly out of scope for V1

- Pendle PT/YT/LP
- arbitrary DeFi yield routing
- recursive max leverage
- user-configurable leverage above approved policy ceilings
- leverage based only on price appreciation
- custody of seed phrases/private keys
- server-side signing as the user
- automatic strategy execution
- arbitrary protocol/contract discovery
- cross-chain support

---

# 2. Product thesis and strategy definition

The strategy is inspired by the conservative "Haunted" pattern: do not recursively lever to the maximum immediately. Instead, start at a low LTV, allow collateral value and/or staking growth to reduce LTV, then borrow only the incremental amount necessary to restore the target LTV.

For Net Vision V1, the strategy is defined by **LTV state**, not by a naive rule such as "NET +10% => borrow again."

### Initial policy

```text
TARGET_LTV        = 0.10   // 10%
REARM_LTV         = 0.08   // candidate default; configurable only by policy deployment/config
MAX_LTV           = 0.12   // initial software guard, always lower than protocol liquidation threshold
AUTO_EXECUTE      = false
PREPARE_ENABLED   = false initially
```

`REARM_LTV` and `MAX_LTV` are provisional implementation defaults and MUST be validated against the actual deployed Morpho market LLTV, oracle behavior, borrow liquidity, and liquidation math before any live transaction preparation.

### Core formula

Let:

- `C` = oracle-valued wsNET collateral in USDG terms
- `D` = current USDG debt including accrued borrow interest
- `T` = target LTV (`0.10` initially)

Current LTV:

```text
currentLtv = D / C
```

If `currentLtv <= REARM_LTV`, candidate incremental borrow to restore target LTV is:

```text
candidateBorrow = max(0, T * C - D)
```

Do **not** use this amount blindly. It must then pass:

- Morpho market liquidity/borrow availability
- resulting-LTV calculation including transaction path effects
- oracle freshness and fail-closed checks
- borrow-rate ceiling
- user/policy per-loop and daily caps
- Spot/Bond route safety and capacity
- gas/fee economics
- contract allowlists

If newly acquired NET is subsequently staked, wrapped, and posted as new collateral, the post-loop LTV must be simulated before the plan is eligible.

---

# 3. Source-of-truth hierarchy

This feature must not treat third-party dashboards as execution authority.

## Tier 0 — on-chain authority

For executable or risk-critical state, **chain state wins**:

- token balances
- sNET/wsNET conversion/exchange-rate state
- Morpho position balances
- debt shares/assets
- LLTV
- oracle price/value used by the market
- market liquidity/available borrow
- deployed contract addresses
- bond contract state and capacity where readable on-chain
- transaction receipts/events

Every Tier-0 read must include:

```ts
{
  value,
  blockNumber,
  blockTimestamp?,
  observedAt,
  source: 'onchain',
  chainId: 4663
}
```

## Tier 1 — official NetNet sources

Use official protocol documentation and official interfaces to establish semantics and deployed constants. Do not trust copied constants if the chain exposes them.

Official mechanics currently state that:

- Robinhood Chain is chain id 4663.
- sNET is the staked/rebasing representation of NET.
- Loopback uses wrapped staked NET (`wsNET`) as collateral to borrow USDG in a Morpho Blue market.
- Real World Bonds accept USDG and deliver discounted NET on a vest, while routing capital into tokenized equities.
- NET AMM buys/sells carry the protocol's trading levy; staking/bonding/protocol operations are treated differently by protocol mechanics.

Use the official NetNet docs/site to discover current contract addresses and exact mechanics, then validate them on-chain.

## Tier 2 — corroboration/analytics sources

The following user-supplied sites are valuable for cross-checking, historical context, and anomaly detection, but must **never** be the sole authority for execution:

- https://defillama.com/protocol/netnet-capital-management
- https://vfat.tools/robinhood/netnet/
- https://netnet.exe.xyz/
- https://galcyon.xyz/netnet-capital?v=20260821
- https://net-net-staking-dashboard.vercel.app/
- https://karas.live/

### Integration rule for Tier 2

Do not scrape rendered HTML unless no structured endpoint exists. First inspect each site's browser/network/API calls and identify stable machine-readable endpoints. Build adapters only for endpoints that are technically/legal-to-use and sufficiently stable.

For each Tier-2 metric persist:

- `sourceId`
- `metricName`
- `value`
- `units`
- `sourceTimestamp` if provided
- `observedAt`
- `freshnessState`
- `rawHash` or evidence pointer where practical

Tier-2 values may trigger a **warning** or an integrity investigation but must not override Tier-0 execution state.

---

# 4. Current external-source observations to account for

At specification time:

- DefiLlama exposes NET price, treasury, supply, staking and protocol-level metrics, but its UI can show values that are semantically surprising (for example TVL reported as zero while a separate staked value is shown). Treat those fields as independently defined, not interchangeable.
- vfat.tools exposes NetNet fund/staking/bond/buyback concepts, but may fail to read live state at times. "Could not read" is UNKNOWN/UNAVAILABLE, never zero.
- karas.live identifies itself as community analytics for NetNet treasury/revenue and exposes areas such as Credit, Buybacks, NET holders and liquidity.
- Some supplied dashboards are JS-heavy or not fetchable by generic crawlers. The coding agent should inspect their network requests rather than assuming an HTML scraping path.

This reinforces an existing Net Vision invariant: **missing upstream data is not zero.**

---

# 5. Proposed architecture

Do not couple this strategy feature to Button Presser marketplace logic.

Recommended structure:

```text
packages/
  net-strategy/
    src/
      types.ts
      haunted-engine.ts
      route-selector.ts
      simulator.ts
      performance.ts
      policy.ts
      freshness.ts
    tests/

  netnet-client/
    src/
      contracts.ts
      staking.ts
      wrapper.ts
      bonds.ts
      nav.ts
      quotes.ts
      source-health.ts
    tests/

  morpho-client/
    src/
      market.ts
      position.ts
      oracle.ts
      borrow.ts
      health.ts
    tests/

  strategy-policy/
    src/
      index.ts
      invariants.ts
      allowlists.ts
      risk-gates.ts
    tests/

apps/
  strategy-worker/
    src/
      worker.ts
      position-watcher.ts
      bond-watcher.ts
      price-watcher.ts
      policy-evaluator.ts
      alert-engine.ts
      shadow-ledger.ts

  web/
    app/
      strategy/
        net/
          page.tsx
    components/
      strategy/
        NetStrategyDashboard.tsx
        PositionCard.tsx
        LoopStatusCard.tsx
        RouteComparisonCard.tsx
        RiskCard.tsx
        ShadowPerformanceCard.tsx
        SourceHealthCard.tsx
```

If the repository's existing shared-client conventions make different names preferable, preserve separation of concerns rather than exact path names.

The existing `apps/market-worker` remains dedicated to NFT/OpenSea indexing. Do not overload it with leverage monitoring.

---

# 6. Canonical domain models

All money/token values must use integer base units or a safe decimal library. **No JavaScript floating-point math for executable financial calculations.**

## 6.1 PositionSnapshot

```ts
type PositionSnapshot = {
  wallet: `0x${string}`;
  chainId: 4663;
  blockNumber: bigint;
  observedAt: string;

  net: DecimalString;
  sNet: DecimalString;
  wsNet: DecimalString;

  wsNetCollateral: DecimalString;
  collateralValueUsdg: DecimalString;
  debtUsdg: DecimalString;
  borrowApr: DecimalString | null;
  availableBorrowLiquidityUsdg: DecimalString | null;

  lltv: DecimalString;
  currentLtv: DecimalString | null;
  liquidationPriceNet?: DecimalString | null;
  healthFactor?: DecimalString | null;

  oracle: {
    value: DecimalString | null;
    updatedAt?: string | null;
    blockNumber: bigint;
    status: 'FRESH' | 'STALE' | 'FAILED' | 'UNKNOWN';
  };
};
```

Do not fabricate health factor or liquidation price if Morpho semantics do not support the proposed formula. Return `null` with explicit reason.

## 6.2 AcquisitionQuote

```ts
type AcquisitionQuote = {
  route: 'SPOT' | 'RWB';
  inputUsdg: DecimalString;
  expectedNetGross: DecimalString;
  expectedNetNet: DecimalString;
  effectiveUsdgPerNet: DecimalString;
  feesUsdg: DecimalString;
  slippageUsdg: DecimalString;
  vestingSeconds?: number;
  capacityUsdg?: DecimalString;
  quoteBlockNumber?: bigint;
  quoteObservedAt: string;
  expiresAt?: string;
  status: 'EXECUTABLE' | 'INFORMATIONAL' | 'UNAVAILABLE' | 'STALE';
  blockers: string[];
};
```

For the RWB route, `expectedNetNet` must reflect any protocol-specific fee/vesting mechanics. For spot, include the NET AMM trading levy and slippage where applicable.

## 6.3 LoopPlan

```ts
type LoopPlan = {
  id: string;
  createdAt: string;
  snapshotBlock: bigint;
  wallet: `0x${string}`;

  policyVersion: string;
  currentLtv: DecimalString;
  targetLtv: DecimalString;
  candidateBorrowUsdg: DecimalString;
  approvedBorrowUsdg: DecimalString;

  quotes: AcquisitionQuote[];
  selectedRoute: 'SPOT' | 'RWB' | null;

  projectedNetAcquired: DecimalString;
  projectedPostLoopCollateralUsdg: DecimalString;
  projectedPostLoopDebtUsdg: DecimalString;
  projectedPostLoopLtv: DecimalString;

  decision: 'WAIT' | 'ALERT' | 'PLAN' | 'BLOCK' | 'DELEVERAGE';
  reasons: string[];
  warnings: string[];
};
```

## 6.4 SourceHealth

```ts
type SourceHealth = {
  sourceId: string;
  authorityTier: 0 | 1 | 2;
  state: 'HEALTHY' | 'DEGRADED' | 'STALE' | 'FAILED' | 'UNKNOWN';
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  freshnessMs?: number;
};
```

---

# 7. Strategy state machine

The engine must be an explicit state machine, not scattered boolean conditions.

```text
UNAVAILABLE
  └─ required Tier-0 data healthy → OBSERVING

OBSERVING
  ├─ currentLtv > policy.maxLtv → RISK_ACTION_REQUIRED
  ├─ currentLtv <= policy.rearmLtv → ELIGIBLE
  └─ otherwise → WAITING

ELIGIBLE
  ├─ policy/source/rate/liquidity guard fails → BLOCKED
  ├─ no economically valid route → WAITING
  └─ valid route → PLAN_READY

PLAN_READY
  ├─ simulation/shadow mode → RECORD_SHADOW_PLAN
  ├─ prepare disabled → ALERT_ONLY
  └─ future: prepare enabled → USER_REVIEW_REQUIRED

USER_REVIEW_REQUIRED
  └─ future wallet-signing flow only after independent transaction-policy verification
```

No state transition may skip required safety validation.

---

# 8. Risk policy

Create a versioned policy object. Never bury these values inside UI code.

```ts
type NetStrategyPolicy = {
  version: string;
  targetLtv: DecimalString;          // initial 0.10
  rearmLtv: DecimalString;           // provisional 0.08
  maxLtv: DecimalString;             // provisional 0.12

  maxBorrowApr: DecimalString;
  minAvailableBorrowLiquidityUsdg: DecimalString;
  maxBorrowPerLoopUsdg: DecimalString;
  maxBorrowPerDayUsdg: DecimalString;

  maxOracleAgeSeconds: number;
  maxQuoteAgeSeconds: number;
  maxSpotSlippageBps: number;
  minBondAdvantageBps: number;

  allowedChainIds: [4663];
  allowedContracts: `0x${string}`[];
};
```

### Mandatory hard gates

The strategy returns `BLOCK` for a new borrow if any is true:

- wrong chain
- wallet position cannot be read confidently
- oracle stale/failed/unknown
- Morpho LLTV cannot be read/validated
- `MAX_LTV >= LLTV` or insufficient safety separation
- borrow APR unavailable or above policy ceiling
- insufficient market liquidity
- contract address not allowlisted
- quote stale
- Spot output cannot account for fee/slippage
- RWB capacity/price/vesting cannot be determined confidently
- proposed resulting LTV exceeds policy target/tolerance
- daily/loop cap exceeded
- contract implementation/critical dependency changes unexpectedly
- source disagreement indicates possible semantic/data-integrity failure

A policy failure cannot be bypassed by the route optimizer.

---

# 9. Spot vs Real World Bond routing

The route selector must compare **effective NET received per USDG**, not headline discount.

## Spot

Calculate from a fresh executable quote where possible:

```text
spotEffectiveCost = totalUsdgSpent / netReceivedAfterTaxAndSlippage
```

Include:

- pool/router path
- NET transfer/trading levy where applicable
- price impact
- slippage tolerance
- gas if economically material
- quote expiry

## RWB

Calculate:

```text
bondEffectiveCost = totalUsdgCommitted / netClaimableNetOfKnownFees
```

Include:

- current bond price
- actual discount to comparable spot acquisition
- remaining capacity
- max/min purchase constraints
- vesting period
- claimability timing
- any route-specific fees
- inventory availability

## Selection

The initial selector should remain simple:

```text
if RWB unavailable or stale:
    choose SPOT if SPOT passes all gates
else if SPOT unavailable or stale:
    choose RWB if RWB passes all gates
else if bondAdvantageBps >= policy.minBondAdvantageBps:
    choose RWB
else:
    choose SPOT
```

Do not invent an opaque AI score. Persist the arithmetic and reasons.

If bond vesting creates material risk/cost, the system may later add an explicit time-value/risk haircut, but V1 should expose the raw difference and avoid pretending precision that has not been validated.

---

# 10. Bond watcher

Implement a dedicated bond-state watcher.

Track at minimum:

- market open/closed
- contract/market identity
- effective NET price
- spot-comparable discount bps
- remaining capacity
- minimum/maximum amount if applicable
- vesting duration
- next relevant expiry/window
- quote/read block
- source health

### Events

```ts
type BondEvent =
  | { type: 'BOND_OPENED'; ... }
  | { type: 'BOND_CLOSED'; ... }
  | { type: 'BOND_DISCOUNT_CROSSED'; thresholdBps: number; ... }
  | { type: 'BOND_CAPACITY_CHANGED'; ... }
  | { type: 'BOND_STALE'; ... }
  | { type: 'BOND_SOURCE_FAILED'; ... };
```

Initial notification examples:

```text
RWB available
Spot effective NET: 812 USDG
Bond effective NET: 744 USDG
Advantage: 8.37%
Capacity: 21,400 USDG
Current LTV: 7.9%
Candidate re-loop: 186 USDG
Status: ALERT ONLY
```

Do not alert if the bond quote is stale or cannot be reconciled.

---

# 11. Shadow ledger and simulation

This is mandatory before transaction preparation.

The worker maintains a **shadow strategy account** representing what would have happened had every eligible strategy plan executed at its observed quote.

Persist each decision:

- timestamp/block
- underlying position snapshot
- policy version
- candidate borrow
- chosen route
- quote details
- expected NET acquired
- projected post-loop position
- all reasons/blockers

Then periodically mark shadow plans using observed/realized values where possible.

### Required comparison

For a configured wallet, show:

1. `BASE_HOLD`: initial NET units only
2. `PLAIN_SNET`: actual or simulated staking-only path
3. `SHADOW_HAUNTED`: staking + conservative re-loop decisions

The important metric is **debt-adjusted NET equivalent**, not gross NET.

```text
netEquivalent = grossNetEquivalent - (debtUsdg / currentNetPriceUsdg)
```

Label this as an analytical metric, not a liquidation or accounting value.

### Attribution

Track separately:

- base NET
- NET gained from staking/rebase
- NET gained via borrowed-USDG acquisitions
- incremental NET from bond discount versus comparable spot route
- accrued USDG interest
- spot fees/tax/slippage
- bond-specific known costs
- resulting net strategy alpha in NET-equivalent terms

Never report `gross NET gained` without adjacent debt/cost disclosure.

---

# 12. Data persistence

Prefer Postgres because Net Vision already uses Postgres as authoritative worker state.

Suggested tables:

```text
net_strategy_positions
net_strategy_market_snapshots
net_strategy_bond_snapshots
net_strategy_quotes
net_strategy_decisions
net_strategy_shadow_ledger
net_strategy_policy_versions
net_strategy_source_health
net_strategy_alerts
```

Each financial snapshot must store:

- chain id
- block number
- observed timestamp
- source identifier
- source freshness

Do not overwrite history. This feature's future moat is the time series of decision inputs and outcomes.

---

# 13. Worker cadence and freshness

Do not couple all metrics to one polling interval.

Suggested starting policy, subject to RPC/provider limits:

- wallet/Morpho position: every 30–60 seconds when watched wallet is active; slower otherwise
- oracle and NET market quote: every 30–60 seconds
- bond state: every 30–60 seconds when open/eligible; 2–5 minutes otherwise
- staking/NAV/non-critical analytics: every 5 minutes
- Tier-2 corroboration dashboards: every 5–15 minutes or appropriate source cadence
- contract/config integrity: startup + periodic checksum/event monitoring

Use jitter and backoff. A failed optional analytics source must not create a retry storm or block Tier-0 reads.

---

# 14. API surface

Read-only initial endpoints:

```text
GET /api/v1/strategy/net/position?wallet=0x...
GET /api/v1/strategy/net/status?wallet=0x...
GET /api/v1/strategy/net/quotes?wallet=0x...
GET /api/v1/strategy/net/bond
GET /api/v1/strategy/net/shadow?wallet=0x...
GET /api/v1/strategy/net/source-health
```

Responses must expose:

- snapshot/block reference
- `observedAt`
- freshness state
- nulls for unavailable values
- human-readable reasons for WAIT/BLOCK/PLAN

Do not expose `0` where the source is unavailable.

Future transaction preparation endpoint, **not enabled in initial release**:

```text
POST /api/v1/strategy/net/prepare-loop
```

It must be feature-flagged and independently revalidate all chain state at request time.

---

# 15. UI specification — `/strategy/net`

Do not alter Button Presser trading UX for this feature.

## Header

```text
NET Accumulator
Conservative 10% LTV strategy monitor
Shadow mode / Alert mode / Prepare mode
```

## Position card

Display:

- NET-equivalent exposure
- sNET balance
- wsNET collateral
- USDG debt
- current LTV
- target LTV
- LLTV / liquidation distance when reliably derivable
- borrow APR

## Loop status

One dominant action state:

- `WAIT`
- `RELOOP AVAILABLE`
- `BLOCKED`
- `RISK ACTION REQUIRED`
- later: `PLAN READY`

Show exact deterministic reason.

Example:

```text
Current LTV: 7.8%
Re-arm threshold: 8.0%
Target: 10.0%
Candidate borrow: 182.40 USDG
```

## Route comparison

Side-by-side:

```text
SPOT NET                    REAL WORLD BOND
Effective price             Effective price
NET after fees/slippage     NET claimable
Tax/fees                    Discount
Immediate                   Vesting
Liquidity                   Capacity
Freshness                   Freshness
```

Highlight route only if it passes all policy gates.

## Shadow performance

Show:

- Plain sNET debt-adjusted NET
- Shadow strategy debt-adjusted NET
- incremental NET-equivalent
- staking contribution
- Haunted contribution
- bond discount contribution
- interest/cost drag

## Data confidence/source health

A compact panel must show degraded/stale sources. Do not hide source problems behind a generic "Live" badge.

---

# 16. Alerts

V1 alerts are informational; they do not transact.

Alert classes:

- re-loop became eligible
- bond discount crossed threshold
- bond opened/closed
- bond capacity materially changed
- borrow APR exceeded ceiling
- LTV crossed warning/max threshold
- oracle/source stale
- Morpho borrow liquidity deteriorated
- policy blocked a previously eligible loop

Deduplicate alerts and apply cool-downs to avoid spam.

---

# 17. Feature flags

Use independent fail-closed flags.

```text
NET_STRATEGY_ENABLED=false
NET_STRATEGY_ALERTS_ENABLED=false
NET_STRATEGY_PREPARE_ENABLED=false
NET_STRATEGY_AUTO_EXECUTE_ENABLED=false
```

Rules:

- absence = false
- enabling strategy display does not enable alerts
- enabling alerts does not enable transaction preparation
- enabling preparation does not enable auto execution
- `NET_STRATEGY_AUTO_EXECUTE_ENABLED` must remain false throughout this implementation plan

Do not create any code path where one broad `TRADING_ENABLED` flag implicitly turns on strategy borrowing.

---

# 18. Transaction-security requirements for future prepare mode

When/if prepare mode is implemented, extend the existing transaction-policy philosophy rather than bypassing it.

For every step decode and independently verify:

- chain id = 4663
- target contract allowlisted
- function selector expected
- wallet/recipient expected
- token addresses expected
- exact/max USDG borrow amount
- exact/min NET output where relevant
- approval token/spender/amount
- target LTV after simulation
- quote freshness
- calldata cannot expand spend beyond reviewed maximum

For a multi-step loop, present a transaction manifest:

```text
1. Borrow X USDG from approved Morpho market
2. Acquire Y NET via [SPOT | RWB]
3. [future/route-dependent] stake NET
4. [future/route-dependent] wrap sNET
5. [future/route-dependent] supply wsNET collateral
```

If bond vesting prevents immediate collateralization, the plan must explicitly model the interval and must not claim that post-loop collateral already exists.

Never auto-approve unlimited token allowances.

---

# 19. Critical semantic questions the coding agent must resolve before live preparation

The agent must produce a short `NET_STRATEGY_SOURCE_AUDIT.md` answering these from deployed contracts/official docs, with evidence:

1. Exact deployed NET, sNET, wsNET, USDG addresses.
2. Exact Loopback/Morpho market ID and all market parameters.
3. Exact LLTV.
4. Exact oracle contract, pricing formula, update/failure semantics, and any NAV/TWAP clamps.
5. Exact current borrow-rate model and how to compute live borrow APR.
6. Exact available-liquidity computation.
7. Exact sNET↔wsNET conversion semantics and whether/how rebase growth appears in wsNET value.
8. Exact bond contract(s), active-market discovery method, price formula, capacity, vesting, claim semantics.
9. Whether RWB inventory/buyback mechanics have changed contract behavior versus earlier bond docs.
10. Exact Spot route(s) that should be considered canonical and the effective 5% levy behavior for that route.
11. Whether direct protocol/bond operations avoid the AMM levy and under what contract allowlists.
12. Any minimum borrow/deposit constraints and gas edge cases.
13. Whether the Loopback "Turbo router" can construct an atomic position, and whether V1 should intentionally avoid it in favor of individually auditable steps.

**No live prepare code until these are resolved.**

---

# 20. Testing plan

## 20.1 Unit tests

`haunted-engine`

- debt=0, collateral>0
- exactly target LTV => WAIT
- exactly rearm LTV => eligible per documented boundary
- below rearm => correct candidate borrow
- above max => RISK_ACTION_REQUIRED
- collateral zero => no division/fabricated LTV
- missing collateral/debt => UNKNOWN/BLOCK, not zero
- decimal precision tests

`route-selector`

- bond clearly cheaper => RWB
- spot clearly cheaper => SPOT
- bond advantage below minimum => SPOT
- stale RWB => not selectable
- stale Spot => not selectable
- both unavailable => BLOCK/WAIT
- capacity lower than desired amount => either partial plan or block according to explicit rule
- bond vesting represented correctly

`risk-policy`

- target/max relationship invalid => startup/config failure
- max LTV too close to or above LLTV => BLOCK
- stale oracle => BLOCK
- borrow APR over ceiling => BLOCK
- daily cap exceeded => BLOCK
- wrong chain => BLOCK
- unknown target => BLOCK

## 20.2 Contract/integration tests

Against deterministic fixtures/fork where feasible:

- read Morpho market parameters
- read wallet collateral/debt
- compare computed LTV with independent known calculation
- read wsNET conversion state
- read bond state
- fetch Spot executable quote
- prove quote math accounts for levy/slippage
- prove all reads share or expose block/freshness semantics

## 20.3 Shadow simulation tests

Use synthetic price paths:

- smooth +10% steps to 10x
- +50%, then -40%, then recovery
- -20/-40/-60/-80% stress
- flat price with staking growth
- borrow APR spike mid-path
- bond discount appears/disappears
- bond capacity exhausted before desired borrow
- oracle becomes stale during eligibility

Verify strategy stops borrowing whenever a hard gate fails.

## 20.4 Failure-mode tests

- RPC timeout
- Morpho read failure
- bond endpoint failure
- analytics dashboard failure
- stale source
- provider returns malformed decimals
- chain reorg/repeated event
- worker restart
- DB outage
- alert retry/duplication

Required behavior: fail closed for new leverage; preserve last-known value only with explicit STALE label.

## 20.5 Security tests before prepare mode

- wrong-chain wallet
- calldata target substitution
- recipient substitution
- malicious spender approval
- amount drift beyond reviewed max
- stale quote replay
- unknown contract
- same plan replayed twice
- transaction submitted but receipt reverted
- partial multi-step completion/recovery

---

# 21. Observability

Add strategy-specific metrics/logs:

- `net_strategy_worker_heartbeat_age_ms`
- `net_strategy_position_snapshot_age_ms`
- `net_strategy_oracle_age_ms`
- `net_strategy_bond_snapshot_age_ms`
- `net_strategy_decision_total{decision}`
- `net_strategy_block_total{reason}`
- `net_strategy_alert_total{type}`
- `net_strategy_source_failure_total{source}`
- `net_strategy_shadow_incremental_net`
- `net_strategy_current_ltv`
- `net_strategy_borrow_apr`

Never log private keys, signatures, or sensitive wallet-provider material.

Health endpoint should distinguish:

- worker online
- Tier-0 chain reads healthy
- Morpho reads healthy
- bond reads healthy/unavailable
- optional Tier-2 corroboration healthy/degraded

Optional analytics degradation must not mark core chain state as healthy if Tier-0 is actually unavailable, nor vice versa.

---

# 22. Implementation phases and gates

## Phase A — Source audit + canonical contracts

Deliver:

- `NET_STRATEGY_SOURCE_AUDIT.md`
- verified contract addresses/market ID
- typed read clients
- source health model
- no UI assumptions hardcoded from community dashboards

**Gate:** all risk-critical values demonstrably trace to Tier-0/on-chain or documented explicit UNKNOWN.

## Phase B — Read-only position monitor

Deliver:

- wallet position snapshot
- current LTV
- target/rearm/max policy display
- borrow APR/liquidity/oracle status
- `/strategy/net` initial page

**Gate:** cross-check position against at least two independent views/manual calculations; no contradictory values.

## Phase C — Spot + bond quote engine

Deliver:

- Spot quote adapter
- bond watcher/adapter
- effective-price normalization
- route comparison UI
- source freshness and blockers

**Gate:** route math reproduced independently with fixtures and live read-only samples.

## Phase D — Haunted decision engine

Deliver:

- explicit strategy state machine
- candidate borrow calculation
- all risk gates
- projected post-loop simulation

**Gate:** deterministic synthetic-path tests and stress tests pass.

## Phase E — Shadow mode

Deliver:

- persistent shadow ledger
- plain-sNET benchmark
- debt-adjusted NET benchmark
- attribution dashboard
- alerts optional

**Minimum soak:** run through enough real market movement to produce multiple WAIT/ELIGIBLE/BLOCK transitions; a calendar minimum may be set by release owner, but do not claim validation solely from elapsed time.

**Gate:** no P0/P1 correctness findings, no stale data masquerading as live, and performance arithmetic reconciles.

## Phase F — Alert mode

Deliver:

- re-loop/bond/risk alerts
- dedupe/cooldown

**Gate:** alerts reflect the exact decision state and never imply execution occurred.

## Phase G — Prepare mode (separate future PR)

Only after explicit founder approval.

Deliver:

- transaction manifest
- transaction-policy integration
- wallet review/signing
- receipt confirmation/reconciliation

**Gate:** Wallet Transaction Security audit PASS + User Journey E2E PASS + failure recovery proof.

## Phase H — Auto execution

**Not part of this plan.** Requires a new architecture/security decision and explicit approval.

---

# 23. Acceptance criteria for this implementation initiative

The coding agent may call V1 complete only when all are true:

1. `/strategy/net` renders a connected wallet's live position without inventing missing values.
2. LTV is computed from documented Morpho/oracle semantics and reconciled independently.
3. The engine identifies WAIT vs ELIGIBLE vs BLOCKED deterministically under the 10% policy.
4. Spot and RWB quotes normalize to comparable effective USDG/NET values.
5. Bond state can generate safe, deduplicated alerts.
6. Every quote/snapshot shows freshness/block provenance.
7. Shadow ledger can compare plain sNET with the Haunted strategy on a debt-adjusted basis.
8. Strategy state survives worker/web restarts without fabricating continuity.
9. Optional dashboard outages degrade visibly but cannot authorize leverage or create false zeroes.
10. No transaction preparation or auto-execution path is live by default.
11. CI passes and mandatory Net Vision audits return PASS.
12. Documentation states unresolved protocol semantics rather than guessing them.

---

# 24. Suggested first coding-agent prompt

```text
Read docs/implementation/NET_ACCUMULATOR_TECHNICAL_PLAN.md and the three docs/agent operating documents before coding.

Implement Phase A only.

Your task is to establish the authoritative contract/data model for NET, sNET, wsNET, USDG, Loopback/Morpho, Spot NET, and Real World Bonds on Robinhood Chain. Do not build transaction execution. Do not add Pendle. Do not modify Button Presser commerce paths.

Produce docs/implementation/NET_STRATEGY_SOURCE_AUDIT.md with evidence for every question in section 19. Build only the typed, read-only client primitives necessary to prove those answers. Every financial read must include block/freshness provenance. UNKNOWN must remain distinct from zero.

Before coding, run Scope & Architecture Guard. During implementation add unit/contract tests. Before opening the PR, run the required Market Data Integrity, Cross-Surface Product Consistency, Production Failure-Mode, API Contract and Release Readiness audits. Report PASS/BLOCK with evidence and list every unresolved semantic question.
```

---

# 25. Design principles that must survive future expansion

1. **Chain first.** Dashboards are corroboration, not execution authority.
2. **Unknown is not zero.** Missing data blocks leverage.
3. **Risk policy outranks optimizer.** A cheaper bond or higher expected return can never bypass a safety gate.
4. **Net-of-debt performance.** Never celebrate gross NET accumulation while hiding USDG liabilities.
5. **No opaque AI execution decisions.** Strategy arithmetic must be deterministic and auditable.
6. **No silent parameter drift.** The bot cannot decide to increase LTV because markets look bullish.
7. **Alerts before automation.** Prove the decision engine in shadow mode before preparing transactions.
8. **Independent feature flags.** Observability, alerts, preparation and execution are separate privileges.
9. **Temporal consistency.** Compare financial facts only at known blocks/freshness windows.
10. **Recovery proof.** Every external dependency failure must have a detection, safe state and recovery path.

The desired end state is not "a leverage bot." It is a conservative, auditable NET accumulation engine that proves when incremental borrowing is justified, chooses the cheaper safe acquisition route, and remains incapable of silently expanding the user's risk envelope.
