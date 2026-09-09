# Branch Contract

Track ID: P4
Track type: Feature
Branch: `feat/basic-intelligence`
Owner: Intelligence agent
Base SHA: `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a`
Base authority epoch: E2
Target epoch compatibility: E2
Worktree: `/Users/immanuellewis/net-vision-wt-intelligence`
Spec: `docs/product/parallel-v1/04_BASIC_MARKET_INTELLIGENCE_ALERTS_SPEC.md`

## Mission

Constrained descriptive intelligence:

```text
Since You Were Here
comparable sales
category movement
watchlist alerts
listing changes
price changes
high sales
freshness/confidence
```

Not: strategy engine, portfolio optimizer, DeFi routing, AI investment recommendations.

## Scope IN

- intelligence services + fixtures
- alerts on watchlist / listing / price
- comparable sales from SQL sales tables when present
- freshness/confidence presentation that consumes E2 health fields (does not invent them)

## Scope OUT

- second market index
- changing `bootstrapCoverage` / `realtimeHealth` definitions
- trading automation

## Authority touched

None of frozen E2. Presentation of existing freshness only.

## Authorities consumed

- SQL sales + listing state via MarketSource
- watchlist from Portfolio (do not fork storage)

## Allowed paths

- `apps/web/lib/intelligence/**` (create)
- intelligence UI sections
- fixture tests

## Shared paths requiring coordination

- watchlist schema (Portfolio owns)
- category movement numbers must use same revision/facts as categories API or explicitly label a different window

## Forbidden paths

Frozen E2 list. Transaction policy. Gear metadata invention.

## Proposed contract changes

None to market authority. May add optional intelligence DTOs.

## Dependencies

Rebase after Gear merge so collection-aware events work. Can develop against Button-only fixtures in parallel.

## Merge barrier

Closed until P3 staging PASS.

## Required tests

- empty sales ≠ volume 0 presented as complete history without confidence
- alerts do not fire on UNKNOWN→UNKNOWN
- Since You Were Here uses a stored cursor, not “now minus 24h” pretending to be presence

## Required failure simulations

- sales table empty
- worker degraded: intelligence shows confidence, not fake movement

## Observability

Alert deliveries / computations tagged with collectionId + snapshot window.

## Rollback

Revert intelligence PR.

## Evidence threshold

Fixture tests + staging section that does not contradict `/api/categories` floors.

## Exit criteria

Listed surfaces exist or are gated. No strategy/AI claims.

## Contract violation rule

If implementation requires a forbidden path or unowned authority change, STOP and escalate before modifying it.
