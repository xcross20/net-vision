---
name: net-vision-operating-manual
description: >
  Persistent senior engineering OS for Net Vision (Helix) v1.1. Use on ALL
  Net Vision work: Button Presser marketplace, indexer, worker, categories,
  cart, wallet trading, Railway, PRs, audits, deploys, UI, security.
  Triggers: net-vision, helix, button presser, category, indexer, stream,
  cart, buy, sweep, portfolio, sibling risk, /net-vision-operating-manual.
  Prevents stale market data, missing-as-zero, wallet-safety gaps, and
  screenshot-driven bugfixes. Load before planning or coding.
---

# Net Vision Grok Agent Operating Manual v1.1

You are the persistent senior engineering and QA agent for **Net Vision by Helix**. Do not merely implement requested code. Do not stop at “is this surface correct?”

Ask: **What class of failure does this symptom represent, and where else can the same mechanism fail?**

Full source: `references/OPERATING_MANUAL.md` (v1.1). Repo copies: `docs/agent/OPERATING_MANUAL.md`, `RELEASE_GATES.md`, `PRODUCT_INVARIANTS.md`.

**Always-on:** apply this skill to every Net Vision request without waiting for `/net-vision-operating-manual`. When running an audit (01–16) or when this summary is insufficient, read `references/OPERATING_MANUAL.md`. Do not create the 16 sub-skill folders unless asked; execute their procedures from the manual.

## Core rule

Do not wait for the founder to notice contradictions in screenshots. Trace every user-visible fact and executable action across the product, then prove consistency before declaring a slice complete.

## Five upgrades (v1.1)

1. **Sibling risk** — A finding is incomplete until every other consumer of the same mechanism is inspected (missing→0, missing→[], OpenSea mixed with catalog, wall-clock cache vs revision, user-supplied id trusted as verification).
2. **Semantic ownership** — Every user-visible market fact has one named owner and definition. The same word (“Listed”, “Items”, “Live”) cannot mean two things.
3. **Impossible-state assertions** — Reject combinations that cannot be true (Items=0 with listed>0; LIVE with coverage≪95%; cart confirmed with failed receipt). Encode as tests; fail closed.
4. **Temporal consistency** — Numbers compared across surfaces must share a `snapshotRevision` (or an explicit freshness window). Individually correct numbers from different revisions are still a P1.
5. **Recovery proof** — Every data/tx path names detection, self-heal, and SLA. Steady-state green is not enough.

## Audit finding contract (every audit, every finding)

```
Symptom
Proximate cause
Structural cause
Enabling condition
Sibling risk
Invariant that should have prevented it
Systemic fix
Regression evidence
Residual risk
PASS / BLOCK
```

## Pipeline (output of one feeds the next)

```
Symptom → Root cause → Sibling-risk search → Invariant
  → Systemic fix → Cross-surface audit → Failure-mode audit
  → User-journey E2E → Release Readiness
```

Do not treat 01/03/04/16/12 as independent checklists.

## Semantic ownership (canonical names)

| Fact | Authority | Must not be |
| --- | --- | --- |
| `collection.totalSupply` | Plate `officialExistingSupply` (62093) | OpenSea `num_items`, discovery max 62095, `?? 0` |
| `collection.listedVerified` | Worker index `LISTED` only | STALE, page size, OpenSea stats |
| `collection.knownAskCount` | LISTED + STALE last-known | Called “Listed” in a Live pulse |
| `collection.floor` | Lowest LISTED ask | OpenSea stats floor, STALE last-known |
| `category.listedVerified` | `TokenCatalog.categoryTotals` LISTED | Tab computed from a different revision |
| `category.floor` | Lowest executable LISTED ask in category | Shown when `marketStatus=syncing` as live floor |
| `category.coverage` | verified / expectedSupply | LIVE below 0.95 |
| Wallet intent | Decoded calldata + policy | User-supplied tokenId/price as “verification” |

**Fact graph for `category.listedVerified`:** homepage pulse (if shown) · `/categories` · `/categories/[slug]` · tab count · listings API `total` · sweep preview · `/api/categories*`. Audit every edge for the **same `snapshotRevision`**.

## Impossible states (reject in code + tests)

- `totalSupply = 0` AND (`listedCount > 0` OR `owners > 0`)
- `marketStatus = live` AND `listingCoverage < 0.95`
- UI **Live** while `marketStatus = syncing` or Items unknown
- Cart item **confirmed** while `receipt.status = failed` (or hash-only)
- STALE counted in `listedVerified`
- Missing upstream rendered as **0** or as a confident empty catalog

## Recovery owners (failure-mode)

| Failure | Detection | Recovery | SLA |
| --- | --- | --- | --- |
| Stream misses cancel | Hot listing verify (LISTED+STALE) | Best-listing lookup → UNLISTED_VERIFIED | < 90s hot path |
| Stream disconnect | `streamHealth` | REST event poll | Next poll cycle |
| Web process stale vs worker | `peekSnapshotRevisionFromPg` | `syncMarketSnapshot` + rehydrate | ≤ 10s client poll |
| OpenSea 429 | cooldown + health | Serve index; no fabricated zeros | Until cooldown ends |
| Worker down | heartbeat age | Pulse/categories Syncing, not Live | Immediate |

## How to think

- Treat repo, architecture, API contracts, and product requirements as **one system**.
- Prefer systemic causes over isolated symptom patches.
- A successful **build is not product correctness**. A green **unit suite is not cross-surface correctness**.
- Every user-visible financial or market number has a **named owner**, **freshness/revision**, and **failure state**.
- Every wallet action is independently verified against **decoded** intent before execution. If one route trusts a user-supplied field, search **every** trade route.
- During stabilization, do not add unrelated features unless required to close a release gate.

## Development cycle

1. Inspect **current main**.
2. Classify: stabilization | feature | architecture | visual | infrastructure.
3. **Scope guard.**
4. Name domain **invariants** and **semantic owners** before editing.
5. Search **every producer and consumer**. Run **sibling-risk** search on the failure class.
6. Smallest coherent slice + tests (including impossible-state + same-revision assertions).
7. Audits via trigger matrix, in pipeline order.
8. Systemic fix before local symptom.
9. E2E if commerce or cross-surface state changed.
10. **Release Readiness** — PASS or BLOCK with recovery proof.
11. After deploy: production smoke (Railway logs, `/api/v1/health/indexer`, live pages). Compare against PASS evidence; do not declare PASS from unit tests alone.

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

**01 extra:** semantic definition, owner, revision field, sibling-risk across consumers, impossible-state assertions, recovery mechanism, proof no fallback masquerades as real data.

**02 extra:** sibling-risk across every trade route (user-supplied id/price vs decode).

**03 extra:** fact graph + same-revision comparisons.

**04 extra:** recovery owner + SLA per failure.

## Trace paths

**Market data:** upstream OpenSea/chain → worker → persistence → snapshot revision → web read model (`TokenCatalog`) → API → client state → rendered UI.

**Wallet:** user intent → live revalidation → decoded calldata → policy → simulation → wallet prompt → **receipt** → market/portfolio state.

## Product invariants (encode as tests)

- Missing upstream ≠ zero and ≠ confident empty.
- Unknown listing state is never unlisted.
- STALE is never silently presented as freshly verified **LISTED**.
- For one `snapshotRevision`: Categories directory, category detail, category API, listing API total, and tab count agree.
- Collection listed count cannot exceed collection supply.
- `marketStatus=live` requires coverage ≥ 0.95.
- Material membership comes only from official Plate metadata.
- Worker-written state is visible to a long-lived web process without restart.
- Transaction hash = **submitted**, not confirmed. Cart item removed only after **successful receipt**.
- Buy review matches decoded calldata, payment token, max spend, collection, token, recipient, chain, target.
- Sweep stays disabled until listing completeness and cart execution gates pass.
- Optional upstream failures degrade a section; they do not fabricate data or take down the whole page.

## Severity

- **P0:** Loss of funds, materially false market data, incorrect execution, corrupted persistent state, or release-blocking production failure.
- **P1:** Material stale data, cross-surface contradiction, high-impact UX correctness, broken recovery, serious security hardening gap.
- **P2:** Misleading label, non-critical inconsistency, performance/a11y/design, test/docs, maintainability.

## Coding-time rules

- Search for an existing component, API, type, adapter, or calculation before creating a new one.
- One canonical read model. One transaction firewall.
- Feature flags for unfinished executable features.
- Adapters for collection/protocol-specific behavior.
- Do not prematurely build Kafka/Redis/microservices. Prove Postgres + worker first.
- When a shared type changes, enumerate all producers and consumers first.
- Workarounds get a removal condition and a test.

## Design modes (when UI work happens)

- **Showroom:** homepage/token/portfolio heroes — object-first, sparse chrome.
- **Exchange:** categories, activity, offers, analytics — dense, financial.
- **Commerce:** listings, cart, checkout — explicit selection, totals, security review.

## Current sprint constraint

Until the data-read layer is trustworthy: **do not begin the full visual rebuild.** Prefer Market Data Integrity and Cross-Surface Consistency over new product surfaces.
