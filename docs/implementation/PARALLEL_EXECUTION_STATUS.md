# Parallel Execution Status

Updated: 2026-09-09 after **A5 PASS** (staging SHA `280f73b`).

Source precedence: (1) verified repo + staging evidence (2) `docs/padp/*` (3) `docs/product/parallel-v1/` (4) Fletcher UI spec (5) Fletcher imagery (6) `buttonvision-mvp.zip` historical only.

**`buttonvision-mvp` is not code to merge.** Do not restore its demo listing provider, per-request market math, prototype schema, or old config.

PADP: `docs/padp/AUTHORITY_MAP.md`, `docs/padp/PARALLEL_EXECUTION_BOARD.md`, `.agent/branch-contracts/`.

## Verdict

**Authority Epoch E2:** Normalized SQL is staging market read authority.

**SAFE TO DEVELOP** product tracks in isolated worktrees from `280f73b`.

**BLOCK**

- merging two product tracks in one staging deploy
- A6 production `MARKET_READ_MODEL=sql` until product proven on staging
- A7 blob retirement
- product agents editing frozen SQL/worker/read-model paths
- “implement everything” in one PR / one agent
- patching Printed Phenolic `Syncing` as if it were the old TTL defect (it is incomplete metadata coverage)

## Tracks

| Track | branch | base SHA | owner | status | gate | merge dependency |
|---|---|---|---|---|---|---|
| A3 closeout | `staging` | `5e1403e` | architecture | **PASS** | soak + PR #15 | — |
| A4 SQL reads | merged PR #16 | `2ea892c` | architecture | **PASS** | tests; flag stayed blob until A5 | A3 PASS |
| A5 staging SQL | `staging` `280f73b` | `280f73b` | architecture | **PASS** 2026-09-09 | existing UI + SQL semantics | A4 + PR #17 |
| A6 production SQL | — | — | architecture | blocked | Release Readiness | product tracks on staging |
| A7 blob retirement | — | — | architecture | blocked | production SQL stable | A6 |
| Portfolio | `feat/portfolio-completion` | `280f73b` | product | worktree ready | modularity + tests | first product merge |
| Commerce | `feat/commerce-hardening` | `280f73b` | product | worktree ready | tx policy + tests | after Portfolio staging PASS |
| Gear | `feat/netnet-gear-foundation` | `280f73b` | product | worktree ready | read-only + real metadata | after Commerce staging PASS |
| Intelligence | `feat/basic-intelligence` | `280f73b` | product | worktree ready | fixtures, no 2nd market | after Gear staging PASS |
| Launch QA | `feat/launch-readiness` | `280f73b` | product | worktree ready | E2E/false-zero | last after each merge |

## File ownership / collision matrix

### E2 frozen (product tracks must not edit)

| Path | why |
|---|---|
| `apps/web/lib/index/sql-read-flags.ts` | read-model switch |
| `apps/web/lib/index/sql-category-queries.ts` | category/collection SQL |
| `apps/web/lib/index/market-read-repository.ts` | SQL read repos |
| `apps/web/lib/market/sql-market-source.ts` | SQL `MarketSource` |
| `apps/web/lib/market/sql-readiness.ts` | bootstrap / realtime / freshness split |
| `apps/web/lib/index/sql-writer.ts` | writers |
| `apps/web/lib/index/pg.ts` | pool / schema apply |
| `apps/web/lib/index/store.ts` | blob dual-write |
| `apps/web/lib/index/schema-v2.ts` | identity / DDL |
| `apps/web/lib/index/canonical-universe.ts` | 62093 envelope |
| `apps/web/lib/market/open-sea-source.ts` | `getMarketSource()` branch |
| `apps/market-worker/**` | worker runtime |
| Railway `MARKET_READ_MODEL` / `MARKET_SQL_*` | staging/prod config |

### Shared — one owner, others adapt

| Path | owner during E2 product sprint | Product-track rule |
|---|---|---|
| `apps/web/lib/market/source.ts` | A4 | consume interface; do not replace |
| `apps/web/lib/market/types.ts` | A4 | additive optional fields only via A4 |
| `apps/web/lib/market/category-contract.ts` | A4 | floor-nulling is A4 semantics |
| `apps/web/lib/data/categories.ts` | A4 | read via `getMarketSource()` |
| `apps/web/components/category/**` | Launch QA visual only after A5 | no readiness math |
| `packages/chain-config` | architecture | Gear adds collection config, does not change Button supply |
| `packages/transaction-policy` | Commerce | A4 does not touch |

### Track B preferred new trees

| Branch | own these |
|---|---|
| Portfolio | `apps/web/lib/portfolio/**`, `app/portfolio/**`, watchlist |
| Commerce | cart/checkout domain, order snapshots, `packages/transaction-policy` tests |
| Gear | `lib/collections/netnet-gear/**`, real metadata fixtures |
| Intelligence | `lib/intelligence/**`, alerts, comparable sales (fixtures) |
| Launch QA | e2e, visual regression, false-zero tests |

## A4 semantic correction (in progress on `feat/a4-sql-read-model`)

Repo + staging discovery **supersede** older spec language that makes TTL reconciliation equal “Syncing.”

SQL read model splits:

| Dimension | meaning |
|---|---|
| `bootstrapCoverage` | ever-established (LISTED \| UNLISTED_VERIFIED \| STALE) / official supply |
| `realtimeHealth` | worker + stream (live / degraded / offline) |
| `stateFreshness` | per-row STALE vs LISTED; last-known floor if floor ask is stale |

Do not blank a LISTED floor because unrelated members aged. Do not count STALE as Live listed. `#62094/#62095` never enter listed/floor.

Staging **stays `MARKET_READ_MODEL=blob` until A5.**

## Track B that may begin immediately (no staging merge)

- Portfolio: `PortfolioRepository` + AssetIdentity + honest unavailable/stale UI; no SQL of its own
- Commerce: cart identity, order snapshots, drift, checkout state machine, simulation/policy tests
- Gear: adapter + **real** metadata fixtures; read-only; no mockup-invented Gear
- Intelligence: deterministic services on `Sale` / `Facet` / `Watchlist` fixtures
- Launch QA: E2E harness, false-zero, Fletcher visual fixtures

After **A5 PASS**: rebase each onto staging, merge **one at a time**: Portfolio → Commerce → Gear → Intelligence → Launch QA.

## A5 (later)

Only: `MARKET_READ_MODEL=blob` → `sql` on staging. Prove current baseline UI (collection, categories, floor, listings, token, sales, activity, portfolio baseline, health). Confirm perpetual category Syncing is gone under the new contract. Then Track B rebase.

## Worktrees (local)

Create from `5e1403e` when an agent starts. Do not share a dirty worktree across tracks.

```text
git worktree add ../nv-a4 feat/a4-sql-read-model
git worktree add ../nv-portfolio feat/portfolio-completion
git worktree add ../nv-commerce feat/commerce-hardening
git worktree add ../nv-gear feat/netnet-gear-foundation
git worktree add ../nv-intel feat/basic-intelligence
git worktree add ../nv-qa feat/launch-readiness
```
