# Net Vision release gates

Source: Operating Manual v1.1. A feature is not done because it merged. Release Readiness aggregates evidence and returns **PASS** or **BLOCK**.

Findings use the v1.1 contract: Symptom, proximate/structural cause, enabling condition, sibling risk, invariant, systemic fix, regression evidence, residual risk, PASS/BLOCK.

## Severity

- **P0:** Loss of funds, materially false market data, incorrect execution, corrupted persistent state, or release-blocking production failure.
- **P1:** Material stale data, cross-surface contradiction, high-impact UX correctness, broken recovery, serious security hardening gap.
- **P2:** Misleading label, non-critical inconsistency, performance/a11y/design, test/docs, maintainability.

Any open **P0** is **BLOCK**. Open **P1** on a market-data, wallet, or consistency path is **BLOCK** for public release.

## Trigger matrix

| Change type | Mandatory audits |
| --- | --- |
| Indexer / market-data | 01, 03, 04, 07, 12, 13 |
| Wallet / trade route | 02, 03, 04, 07, 11, 12, 16 |
| New collection / asset family | 01, 03, 04, 07, 10, 12, 16 |
| UI / visual rebuild | 03, 05, 06, 08, 09, 12 |
| Schema migration | 01, 04, 07, 10, 12, 13 |
| Dependency update | 11, 12 |
| New product feature | 14 first, then feature-specific |
| Release | 01, 02 if trading changed, 03, 04, 08, 09, 11, 12, 13 |

Audit IDs: **01** Market data integrity · **02** Wallet tx security · **03** Cross-surface consistency · **04** Failure modes · **05** Design QA · **06** Visual regression · **07** API contract · **08** Performance · **09** A11y · **10** Data-model migration · **11** Supply-chain · **12** Release readiness · **13** Observability · **14** Scope/architecture guard · **15** Stale-code/dead-path · **16** User-journey E2E.

## Lifecycle

| When | Output |
| --- | --- |
| Before coding | Plan + explicit invariants (14) |
| During coding | Code + tests |
| Before PR | Audit report |
| Before merge | PASS / BLOCK |
| After deploy | Production smoke + observability |

## Current sprint constraint

Until the data-read layer is trustworthy: **do not begin the full visual rebuild.** Prefer audits **01** and **03** over new product surfaces. Do not add Kafka/Redis/rewrites; prove Postgres + worker first.

## Evidence required to claim PASS

- Findings by P0 / P1 / P2 using the 10-field contract
- Sibling-risk search completed for each P0/P1 mechanism
- Impossible-state tests green
- Same-revision cross-surface comparisons (not wall-clock)
- Recovery owner named for each data/tx failure class
- Exact files/functions
- Invariants/tests added
- Remaining risk
- Production smoke when the slice was deployed: Railway logs, `/api/v1/health/indexer`, live pages (Items = 62093, not 0; Live only when coverage allows)
