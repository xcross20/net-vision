# Net Vision Parallel Execution Master Plan
Version: 1.0
Date: 2026-09-07
Target repo: xcross20/net-vision

## Mission

Finish the current Net Vision product while preserving the ability to add more NET collections and later reuse the infrastructure elsewhere.

The active scope is intentionally narrow:

1. Reliable Button Presser market
2. Portfolio
3. Transactions
4. NetNet Gear
5. Basic market intelligence and alerts
6. Launch UX and cross-surface consistency

The live market-data migration remains owned by the primary architecture agent. Parallel feature work must not invalidate A3 soak/parity or change the active request-path authority until explicitly approved.

## Active Parallel Workstreams

### P1: Portfolio
Branch: `feat/portfolio-completion`

Goal:
Make `/portfolio` the authoritative user-owned asset surface.

### P2: Commerce and Transaction Safety
Branch: `feat/commerce-hardening`

Goal:
Complete Buy Now, cart, and safe sequential checkout.

### P3: NetNet Gear
Branch: `feat/netnet-gear-foundation`

Goal:
Use Gear as the first second-collection proof without copying Button Presser architecture.

### P4: Basic Market Intelligence and Alerts
Branch: `feat/basic-intelligence`

Goal:
Add useful descriptive intelligence without building a strategy engine.

### P5: Launch UX and Cross-Surface Consistency
Branch: `feat/launch-readiness`

Goal:
Make all current surfaces agree on listing, price, owner, freshness, and health state.

## Parked Work

Do not actively build:
- My Gameplan
- strategy engine
- protocol opportunity router
- autonomous execution
- forecasting games
- XP/reputation
- white-label SaaS
- QUOTRONS deployment
- Robinhood Chain-wide product
- customer tenancy/billing/admin

These stay in the idea backlog.

## Shared Modularity Rule

Build NET-first, but do not place collection-specific logic into generic market, portfolio, commerce, or intelligence layers when it can live behind a collection adapter.

## Shared Identity Rule

Never use token ID alone as asset identity.

Canonical identity:

```ts
type AssetIdentity = {
  ecosystemId: string
  collectionId: string
  tokenId: string
}
```

## Shared Data-State Rule

Unknown, unavailable, stale, and zero are different.

Never render zero when data is unavailable.

## Shared Commerce Rule

Displayed listing state is not executable authority.

Execution path:

```text
display
-> cart snapshot
-> checkout review
-> fresh revalidation
-> prepare
-> policy validation
-> simulation
-> wallet signature
-> receipt
-> reconciliation
```

## Integration Order

After A3 PASS:

1. Shared modular primitives that do not alter runtime authority
2. Portfolio
3. Commerce hardening
4. Gear read-only foundation
5. Basic intelligence
6. Launch consistency
7. A4/A5 integration as separately approved

## Files Parallel Agents Should Avoid During A3 Soak

Unless explicitly authorized:
- `apps/web/lib/index/sql-writer.ts`
- `apps/web/lib/index/pg.ts`
- `apps/web/lib/index/store.ts`
- `apps/web/lib/index/schema-v2.ts`
- market-worker runtime
- read-model feature flags
- event ordering logic
- staging runtime configuration

Prefer new feature-local files, adapters, repositories, fixtures, tests, and docs.

## Universal Definition of Done

Every workstream must provide:
- explicit invariants
- domain types
- API/service contracts
- loading/empty/stale/unavailable/error states
- unit tests
- integration tests
- E2E coverage
- failure-mode tests
- observability
- modularity review
- PASS/BLOCK report

No UI-only "done."
