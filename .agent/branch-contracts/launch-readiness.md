# Branch Contract

Track ID: P5
Track type: QA
Branch: `feat/launch-readiness`
Owner: Launch QA agent
Base SHA: `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a`
Base authority epoch: E2
Target epoch compatibility: E2
Worktree: `/Users/immanuellewis/net-vision-wt-launch`
Spec: `docs/product/parallel-v1/05_LAUNCH_UX_CONSISTENCY_QA_SPEC.md`

## Mission

Break everyone else's work. Do not implement features.

Own: Fletcher visual regression, responsive testing, cross-surface data consistency, failure states, accessibility, E2E.

## Scope IN

- consistency tests (same revision / named owners)
- false-zero / unknown-vs-empty tests
- golden Button Presser journey harness
- Fletcher / a11y / responsive checks
- release issue classification (P0/P1/P2)

## Scope OUT

- product features
- SQL authority changes
- “fix” by changing readiness math in components

## Authority touched

None. May add tests that pin E2 semantics.

## Authorities consumed

All product contracts + E2 market facts.

## Allowed paths

- `apps/web` tests, e2e, visual regression
- `tools/*.mjs` e2e
- docs of failures
- **visual-only** tweaks in `apps/web/components/category/**` after a product merge, never readiness math

## Shared paths requiring coordination

Any UI snapshot update that overlaps Portfolio/Commerce/Gear/Intelligence — rebase onto the merged track first.

## Forbidden paths

Frozen E2 list. Inventing market numbers in tests by weakening assertions.

## Proposed contract changes

None.

## Dependencies

Runs after each serial merge. Final merge last.

## Merge barrier

Last in queue. After each prior merge, this track rebases and reports PASS/BLOCK.

## Required tests

- categories directory vs detail vs listings total
- unknown ≠ 0
- STALE not counted as LISTED
- `marketStatus=live` requires coverage ≥ 0.95
- Gear/Button identity collision
- failure states (worker down, empty sales)

## Required failure simulations

Worker offline, SQL empty sales, Printed Phenolic still syncing, listing drift.

## Observability

Publish a release-readiness note with PASS/BLOCK, not a dashboard rewrite.

## Rollback

Revert QA-only PR. Does not change production data.

## Evidence threshold

Written PASS/BLOCK after each staging integration.

## Exit criteria

Golden Button journey specified and automated as far as staging allows. Gear read-only journey covered. Fletcher regressions listed.

## Contract violation rule

If implementation requires a forbidden path or unowned authority change, STOP and escalate before modifying it.
