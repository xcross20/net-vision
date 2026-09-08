# Parallel Agent Orchestration and Branch Plan
Version: 1.0

## 1. Objective

Run the product-completion workstreams concurrently without merge chaos or invalidating the live market-data migration.

## 2. Branches

- `feat/portfolio-completion`
- `feat/commerce-hardening`
- `feat/netnet-gear-foundation`
- `feat/basic-intelligence`
- `feat/launch-readiness`

Each branch starts from the currently approved shared base.

## 3. Ownership

### Portfolio agent
Owns:
- portfolio domain
- portfolio UI
- watchlist storage
- portfolio tests

### Commerce agent
Owns:
- cart domain
- checkout state machine
- transaction review
- transaction-policy additions/tests

### Gear agent
Owns:
- Gear adapter
- Gear fixtures
- Gear facet/metadata code
- read-only Gear collection integration

### Intelligence agent
Owns:
- comparable sales
- alerts
- Since You Were Here
- freshness/confidence presentation

### Launch QA agent
Owns:
- cross-surface contract tests
- golden E2E
- responsive/accessibility QA
- release issue classification

## 4. Collision Avoidance

If two agents need the same shared file:
1. one agent becomes owner
2. the other introduces a feature-local adapter/interface
3. merge shared change first
4. rebase dependent branch

Do not have two agents independently edit the same core market-runtime file.

## 5. Runtime Freeze During A3

No parallel agent changes:
- market event ordering
- SQL writer
- worker cursor
- reconciliation semantics
- read-model switch
- production/staging DB config

## 6. Required Agent Prompt Prefix

Every agent receives:

```text
You are working inside Net Vision during an active market-data migration.
Do not alter A3 runtime authority or staging soak behavior.
Your work must preserve the Shared Modularity Code Contract.
Prefer new feature-local files and explicit interfaces over modifying shared runtime internals.
Do not claim completion without tests and evidence.
```

## 7. Required Output From Each Agent

- summary
- changed files
- architecture decisions
- invariants
- tests
- failure simulations
- observability
- modularity review
- known risks
- merge dependencies
- PASS/BLOCK

## 8. Merge Gate

Before merge:
- branch rebased
- CI green
- no A3 runtime files changed unexpectedly
- modularity checklist passed
- no P0/P1 introduced
- owner review of shared contracts
- E2E evidence where applicable

## 9. Suggested Execution Order

While A3 is still soaking:
- Portfolio agent can work on domain/UI/repository boundaries
- Commerce agent can work on cart/state-machine/policy tests
- Gear agent can work on fixtures/adapter/metadata model
- Intelligence agent can work on deterministic service/tests
- Launch agent can build consistency fixtures and E2E harness

After A3 PASS:
- integrate shared read-model changes carefully
- rebase feature branches as needed
- then merge feature work by dependency order
