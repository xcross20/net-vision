# Launch Gap Report

Date: 2026-09-10 (updated after **PR20 PASS**)
Inspected: GitHub, Railway, staging/production HTTP.
OS: Net Vision v1.1 + PADP Epoch E2.
Verdict: **LAUNCH BLOCK** (do not reduce the bar). PR #20 closed the SQL read-completeness P0s on staging. Public MVP is still blocked on production SHA, Buy E2E, and remaining honesty/Railway items.

### PR20 PASS (2026-09-10)

| Check | Evidence |
| --- | --- |
| CI `check` | SUCCESS (run 34489096357) |
| Staging web SHA-pin | deploy `c27dc831` SUCCESS @ `baf2080` |
| Merged | `ceac900` on `origin/staging` |
| Listings | `/api/categories/digits-1/listings` total 2, ids 2 and 4, no envelope |
| Homepage | 200, **27** `/tokens/` links (collection-wide `listTokens`) |
| Inventory | seller `0xaf6193fd…` → **117** tokens including #2; unknown `0x…0123` → `200 []` (owner index is populated, so empty is a real empty wallet, not a stub) |
| Slug | `digits-1` 200; `not-a-real-category-xyz` **404** (not zeros) |
| Revision | collection/categories/listings all `market_events` high-water (~927k), not blob 123840 vs establishedCount 61940. Sequential calls differ by tens of events (live writer). |
| Chain slug | `resolvedChainSlug=robinhood` |
| Zeros | no live category with listed=0 and verified=0 |
| Flags | trading still off; production still blob |

Closed: P0-SQL-LIST, P0-SQL-ACCOUNT, P0-BUY-SLUG, P0-REV, P0-ZERO (SQL path).

Do not treat stale dual-track / Gear-first plans as current. This sprint’s public MVP is **Button Presser only**. Gear, RWA, strategy, native listing, offers, sweep, Helix platformization are **P2 POST-LAUNCH** unless they are required to close a P0.

---

## Current SHAs (evidence, 2026-09-10)

| Ref | SHA | Notes |
| --- | --- | --- |
| `origin/staging` | `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a` | A5 SQL read model + PR #17 build skip |
| Staging web deploy | `5a9d6415` SUCCESS @ `280f73b` | Matches intended staging SHA |
| Staging worker deploy | `695838e4` SUCCESS @ `280f73b` | SHA-pinned manually, **not** in GHA |
| `origin/main` | `fa1fad243116b27a72169b35908b17d2dc3c5f1e` | Pre-A4 blob architecture |
| Production web | `a31eabfc` SUCCESS @ `fa1fad2` | **Not** the staging candidate |
| Intended production candidate | **not yet** | Must be a promotion of proven staging SQL **after** P0s below. Not `fa1fad2`. Not an unreviewed `staging` dump onto `main`. |

`origin/staging` is **13 commits** ahead of `main` (A1–A5). Railway GitHub source for production remains `main`. Staging web is SHA-deployed via GHA `serviceInstanceDeployV2`; `railway set-variables` / source redeploy still rebuilds from **`main`** and can wipe the A5 image.

Open PRs: **#18** PADP docs only (`feat/padp-epoch-e2` → `staging`). Product worktrees exist at `280f73b` with **no product commits**.

---

## Live runtime (2026-09-10)

### Staging (`MARKET_READ_MODEL=sql`)

- Collection: `source=sql`, `fresh=true`, supply **62093**, listed **6108**, floor **1.87**, `marketStatus=live`, bootstrap **0.9975**, `realtimeHealth=live`
- Categories: **23 live / 1 syncing** (Printed Phenolic coverage ~0.53 — metadata, not TTL)
- Indexer: `workerOnline=true`, stream connected, `eventProjectionFailures=0`
- SQL write p95 **329ms** (above the 250ms soak tripwire)
- Trading: `TRADING_ENABLED` unset path / `NEXT_PUBLIC_TRADING_ENABLED=false`, `BUY_ENABLED=false`, sweep/offers off

### Production (blob, no `MARKET_READ_MODEL`)

- Collection: `source=opensea`, `fresh=false`, supply **62093**, listed **4711**, floor **1.16**, `marketStatus=syncing`
- Homepage HTML: **40** “Syncing” hits (blob TTL defect still live)
- Indexer: `workerOnline=true`, stream connected, **no** `sqlWriter` object
- Disk recovered after 20 GB full (now ~24 GB used — volume grown; still a capacity risk)

Production is a **different product** from staging: blob request path, perpetual Syncing, older SHA.

---

## Scope that must not block launch

P2 unless a P0 depends on it:

- NetNet Gear
- RWA / strategy / AI recommendations
- Native listing / accept offer / make offer / sweep
- Generalized Helix platformization
- Advanced automation / gamification
- Acquisition cost / P&L if data cannot support it

---

# P0 LAUNCH BLOCKERS

Any open P0 is launch BLOCK. Public trading stays off until P0-BUY is closed with a real receipt.

## P0-PROD-SHA — Production is not the intended candidate

**Symptom.** Production web runs `fa1fad2`. Staging SQL/A5 (`280f73b`) is not on production. Production `/categories` still exhibits the blob “Syncing” defect.

**Root cause.** No GHA production deploy. Railway source = `main`. A1–A5 never merged to `main` (intentional until A6).

**Sibling-risk.** Worker and web can diverge; `set-variables` on staging redeploys `main` into staging (already happened during A5).

**Invariant.** Production must run the intended SHA. Homepage → category facts must share that SHA’s read model.

**Proposed systemic fix.** After SQL read holes (P0-SQL-*) are fixed and DATA PASS: promotion PR `staging` → `main`, SHA-pin production web **and** worker with `serviceInstanceDeployV2`, then explicit `MARKET_READ_MODEL=sql` on production (**A6, RED / human approval**). Never `connect-service-source --branch staging`.

**Files/authority.** `.github/workflows/ci.yml`, `docs/deploy/STAGING.md`, Railway source. Authority: deployment topology (one owner).

**Test plan.** After promote: production `/api/v1/collection` `freshness.source=sql`, deploy SHA equals `GITHUB_SHA` of the promotion commit, categories 23 live.

**Rollback.** Redeploy previous production SHA `fa1fad2`; unset production `MARKET_READ_MODEL`.

**BLOCK condition.** Production SHA ≠ intended candidate, or production still blob while we claim SQL launch.

**RED.** A6 flag flip and `staging`→`main` merge require human approval. Do not silent-cutover.

---

## P0-SQL-LIST — SQL `listTokens()` without category returns empty

**Symptom.** `SqlMarketSource.listTokens` returns `{ tokens: [], total: 0 }` when `filter.category` is missing. Homepage hero, layout Cmd+K search tokens, and any “cheapest N listings” use `listTokens({ listedOnly: true, limit })` with **no category**.

**Root cause.** A4 SQL source implemented category listings only.

**Sibling-risk.** `apps/web/app/page.tsx`, `apps/web/app/layout.tsx` (`Shell` search), `/market` if it lists without slug, any future collection-wide cheapest rail.

**Invariant.** Missing filter ≠ empty market. Collection LISTED rows exist (6108 on staging).

**Proposed systemic fix.** Collection-wide SQL `ORDER BY best_price_decimal ASC` with official-supply bound; keep category query when slug present. Tests: listed tokens without slug are non-empty when LISTED rows exist; envelope ids excluded.

**Files/authority.** `sql-category-queries.ts`, `market-read-repository.ts`, `sql-market-source.ts`. Authority: market read (architecture owner).

**Test plan.** Unit + staging homepage HTML contains listed token ids / prices; search palette has tokens.

**Rollback.** Revert PR; staging stays category-only (worse UX, not data corruption).

**BLOCK condition.** Homepage cheapest/search tokens empty while collection `listedCount > 0`.

---

## P0-SQL-ACCOUNT — SQL account inventory is a confident empty wallet

**Symptom.** `listAccountTokens`, `getAccountListings`, `getAccountOffers` return `[]`. Portfolio fetch 200 + empty array is rendered as **0 holdings**, not unavailable.

**Root cause.** SQL `MarketSource` stubs. Portfolio only sets `unavailable` on HTTP error.

**Sibling-risk.** `/portfolio` inventory/listed tabs, any “you own this” on token detail, post-buy ownership update.

**Invariant.** Missing upstream ≠ empty wallet. Unknown ≠ zero.

**Proposed systemic fix.** Query `tokens.owner_address` / sale buyer; if owner coverage is incomplete, fail the API (`503` + `unavailable`) instead of `[]`. Portfolio already has the unavailable copy.

**Files/authority.** `sql-market-source.ts`, `market-read-repository.ts`, `app/api/v1/account/[address]/nfts/route.ts`, `PortfolioView.tsx`.

**Test plan.** Stub empty SQL owners → API not 200 `{tokens:[]}`. Fixture owner → tokens returned with `collectionId`.

**Rollback.** Revert; portfolio stays empty (status quo).

**BLOCK condition.** Connected wallet with known Button holdings shows a confident empty grid.

---

## P0-BUY-SLUG — Buy prepare cannot run on SQL freshness

**Symptom.** `POST /api/trade/buy/prepare` returns 503 `chain slug not resolved; OpenSea not configured` whenever `getFreshness().resolvedChainSlug` is null. SQL freshness **always** sets `resolvedChainSlug: null`.

**Root cause.** Blob source resolved the OpenSea chain during catalog hydrate. SQL source never sets it. Prepare still requires it to construct the OpenSea client.

**Sibling-risk.** Cart revalidate if it uses freshness; any OpenSea fulfillment call on SQL web.

**Invariant.** Transaction policy fail-closed is correct; launch still needs a working Buy path **after** flags are on. A SQL-backed site must not make Buy structurally impossible.

**Proposed systemic fix.** SQL `getFreshness()` sets `resolvedChainSlug` from chain-config / `OPENSEA_CHAIN` hint (`robinhood`), not from blob hydrate. Do **not** enable `TRADING_ENABLED` in this fix.

**Files/authority.** `sql-market-source.ts`, `buy/prepare/route.ts`. Authority: market read + transaction policy (do not weaken prepare).

**Test plan.** SQL source freshness.slug is `robinhood`. Prepare still 503 while `BUY_ENABLED=false`. With flags on in test, slug is not the failure.

**Rollback.** Revert slug; Buy stays impossible on SQL (safer than a wrong chain).

**BLOCK condition.** SQL freshness cannot name the OpenSea chain, so live Buy E2E cannot start.

---

## P0-REV — Two clocks named `snapshotRevision`

**Symptom.** Collection snapshot uses `establishedCount` as `snapshotRevision` (~62k). Categories/listings APIs stamp blob `snapshotRevision()` from `lib/index/store.ts` (different integer). Cross-surface equality is undefined.

**Root cause.** SQL reads bolted onto blob envelope fields.

**Sibling-risk.** Categories directory vs detail vs listings `total` vs homepage pulse; client poll that thinks revision is monotonic.

**Invariant.** One `snapshotRevision` (or explicit window) for compared facts.

**Proposed systemic fix.** One SQL high-water (e.g. worker checkpoint revision or `max(market_events)`). All SQL JSON envelopes use it. Stop using blob store revision on SQL routes.

**Files/authority.** `sql-market-source.ts`, `app/api/categories/**`, `store.ts` consumers. Authority: market read.

**Test plan.** Collection and `/api/categories` share the same revision field meaning; tests fail if blob counter is used under `MARKET_READ_MODEL=sql`.

**Rollback.** Revert; residual P1 remains (A5 accepted this as debt; **launch does not**).

**BLOCK condition.** Launch QA cannot prove cross-surface consistency.

---

## P0-ZERO — `fallbackCategoryMetrics` fabricates zeros

**Symptom.** If `getCategoryMetrics` returns null, UI gets `listedCount: 0`, `coverage: 0`, `syncing`. SQL-build `FailingMarketSource` and runtime misses take this path.

**Root cause.** “Never 404 a real category” implemented as fake metrics.

**Sibling-risk.** Directory fill of missing slugs; prerender if skip-SQL source leaks; `/api/v1/health/coverage`.

**Invariant.** Missing upstream ≠ zero and ≠ confident empty catalog.

**Proposed systemic fix.** Distinguish **unavailable** vs **syncing-with-unknown**. Do not emit listedCount=0 as fact when live metrics are null. Directory should omit or mark `unavailable`.

**Files/authority.** `apps/web/lib/data/categories.ts`.

**Test plan.** Null live metrics → response/UI unavailable, not Items=0 Live.

**Rollback.** Revert to fallback (false zeros return).

**BLOCK condition.** Any public surface can show 0 listed as a fact when SQL/OpenSea failed.

---

## P0-SHELL — Root layout fetch can 500 every page

**Symptom.** `app/layout.tsx` `Shell` awaits `listTokens` + `listCategories` with no catch. Homepage `settle()` never runs if the header throws. No `error.tsx` / `loading.tsx`.

**Root cause.** Shared chrome treated as infallible.

**Sibling-risk.** Every route: market, categories, token, portfolio, activity.

**Invariant.** Optional upstream failure degrades a section; it does not take down the product.

**Fix.** Catch to empty arrays (search degrades). Add `app/error.tsx`.

**Files.** `app/layout.tsx`.

**BLOCK condition.** A SQL timeout in the header 500s `/`.

---

## P0-BUY-CTA — “Buy now” while trading is off

**Symptom.** Token page shows **Buy now** for connected wallets. Prepare is kill-switched (503). `BuyDrawer` omits `acceptedPriceRaw` (400 even if flags on). `TradingGateNotice` existed unused.

**Root cause.** UI not bound to the same kill switch as `/api/trade/buy/prepare`.

**Sibling-risk.** Add to cart, sweep, make offer.

**Invariant.** Disabled money paths must not look executable.

**Fix.** Render `TradingGateNotice` unless `NEXT_PUBLIC_TRADING_ENABLED=true`. Keep OpenSea outbound. Do not enable flags here.

**Files.** `TokenCommercePanel.tsx`, `TradingGateBanner.tsx`.

**BLOCK condition.** Public users believe they can buy on Net Vision before Buy E2E PASS.

---

## P0-MARKET-3DIGIT — /market “3 Digit” filter was 1 Digit

**Symptom.** `MarketView` `3digit` used `slugs.has('digits-1')`. Users looking for 3-digit Buttons get 1-digit.

**Root cause.** Typo / wrong slug. SQL tokens also ship `traits: []`, so slug filters fail entirely unless we use token-id identity.

**Sibling-risk.** Palindrome/repeating filters; any client filter on SQL tokens.

**Invariant.** Token ID = displayed number. 3-digit membership is `digits-3` or id length 3.

**Fix.** `digits-3` / `repdigit` / palindrome, with token-id fallbacks.

**Files.** `components/ui/MarketView.tsx`.

**BLOCK condition.** Category navigation lies about membership.

---

## P0-BUY-E2E — No real single-NFT purchase evidence

**Symptom.** Trading flags are correctly **off**. There is no `docs/launch/BUY_E2E.md` and no receipt. Unit tests are not Buy PASS.

**Root cause.** Intentional kill switch; SQL holes (P0-BUY-SLUG) plus flags.

**Sibling-risk.** Sweep/offer/list UI still exists (`SweepDrawer`, `OfferActions`, portfolio “List” to OpenSea). Must stay non-executable.

**Invariant.** One real inexpensive Button purchase: listing → cart → revalidate → drift → simulate → wallet → receipt → listing gone → portfolio.

**Proposed systemic fix.** After P0-SQL-* and P0-BUY-SLUG: controlled flag-on **staging only**, real cheap LISTED token, write `BUY_E2E.md`. Keep sweep/offers/native listing disabled. Production trading stays off until that evidence.

**Files/authority.** `kill-switch.ts`, trade routes, `docs/launch/BUY_E2E.md`. Authority: transaction policy. **RED** to enable flags on production.

**Test plan.** Manual receipt + indexer reconciliation. Failed receipt does not clear cart.

**Rollback.** Flags false.

**BLOCK condition.** Declaring LAUNCH PASS without a real receipt.

---

# P1 FIX BEFORE PUBLIC TRAFFIC

Open P1 on market-data, wallet, or consistency is also public-release BLOCK (`RELEASE_GATES.md`).

## P1-WORKER-PIN — Staging/production worker not in GHA SHA deploy

**Symptom.** `deploy-staging-web` deploys web only. Worker SHA is ops/manual. Source redeploy can reset worker to `main`.

**Root cause.** Stale ci.yml comment (“worker stays off until A2/A3”).

**Sibling-risk.** Production worker vs web SHA split; SQL writer version skew.

**Invariant.** Web and worker of an environment run the same intended commit.

**Fix.** GHA `serviceInstanceDeployV2` for worker service IDs on push to `staging` / (later) `main`. Document production worker service ID.

**Files.** `.github/workflows/ci.yml`, `docs/deploy/RAILWAY_MARKET_WORKER.md`.

**Test.** Worker deploy SHA equals web SHA after staging push.

**Rollback.** Remove worker job; manual pin.

**BLOCK.** Worker SHA ≠ web SHA on the launch environment.

## P1-SETVAR — Variable changes redeploy `main` onto SHA staging

**Symptom.** Railway `set-variables` without `skipDeploys` rebuilds from GitHub `main`.

**Root cause.** SHA deploys are not the GitHub source.

**Sibling-risk.** A6 flag flip on production is a variable change — must pin SHA after.

**Fix.** Runbook: `skipDeploys: true` then `serviceInstanceDeployV2` of intended SHA. Never `connect-service-source`.

**Files.** `docs/deploy/STAGING.md`, `docs/launch/RAILWAY_RELEASE_AUDIT.md`.

**BLOCK.** Any launch env running `main` while we believe it is `280f73b+`.

## P1-HEALTH — Health endpoints lie in small ways

**Symptom.** `/api/health` always `ok`, `source=index`. `postgresConnected` = URL present. Coverage `indexerRunning` is process-local (false on web).

**Sibling-risk.** Railway healthcheck green while Postgres is full (already happened).

**Invariant.** Operator health is honest; liveness ≠ market truth.

**Fix.** Keep `/api/health` as liveness. Indexer health: live `SELECT 1`; coverage uses worker heartbeat not process-local indexer.

**Files.** `app/api/health/route.ts`, `lib/index/health.ts`, coverage route.

**BLOCK.** Launch runbook that treats `/api/health` as market authority.

## P1-P95 — Staging SQL write p95 329ms

**Symptom.** Soak tripwire was p95>250ms. Observed 329ms with `eventProjectionFailures=0`.

**Root cause.** Volume/WAL/checkpoint or query shape; needs measurement not a UI patch.

**Fix.** `RAILWAY_RELEASE_AUDIT` metrics; indexes; WAL/disk headroom on prod (≥40 GB).

**BLOCK.** Sustained p95>>250 with growing WAL or disk >90%.

## P1-SEARCH — Search is a client filter of layout token arrays

**Symptom.** `SearchCommand` filters whatever `layout` passed (24 listings). SQL empty listTokens ⇒ search cannot find a Button by id unless it is in that array.

**Sibling-risk.** Mobile full-screen search; “faster than OpenSea” launch goal.

**Fix.** Token-id path: navigate to `/tokens/[id]` even if not in the array; optional SQL prefix search. Do not invent a second catalog.

**Files.** `SearchCommand.tsx`, `MarketHeaderClient.tsx`, SQL listTokens.

**BLOCK.** Typed token id 68 does not open `#68`.

## P1-SALES-EMPTY — Category sales often `volume: 0, sales: []`

**Symptom.** SQL sales reads exist but many categories show empty history. Must not be presented as “no one ever sold” if ingestion is incomplete.

**Fix.** Honest empty: “No sales in the tracked window” + `trackedSince`; do not draw 0 volume as a complete statistic without confidence.

**Files.** `CategorySales.tsx`, SQL sales ingest (writer — frozen unless P0).

**BLOCK.** Fake 7d volume/floor-change charts on empty history (do not add speculative analytics).

## P1-PORTFOLIO-VALUATION — “Estimated context value” sums listing/last-sale

**Symptom.** Sums `listingPrice` else `lastSalePrice`. Not floor-based, not cost basis. Can look like P&L.

**Fix.** Label as “listed value” only for LISTED; unknown otherwise. No fake P&L.

**Files.** `PortfolioView.tsx`.

**BLOCK.** Public copy that implies acquisition P&L.

## P1-LIST-CTA — Portfolio “List” / “Edit listing” opens OpenSea

**Symptom.** Native listing is post-launch but the CTA looks in-product.

**Fix.** Copy: “List on OpenSea” or hide until native listing. Do not enable `LIST_ENABLED`.

**Files.** `PortfolioView.tsx`.

## P1-OFFERS-UI — Offers/sweep chrome while money paths disabled

**Symptom.** Category offers, sweep drawer, accept-offer route exist. Flags off — good. Chrome can still imply they work.

**Fix.** Gate UI with the same kill switch; disabled + reason, not a dead button that looks active.

**Files.** `SweepDrawer.tsx`, `OfferActions.tsx`, `CategoryOffers.tsx`, `TradingGateBanner.tsx`.

---

# P2 POST-LAUNCH

- NetNet Gear collection adapter and Gear commerce
- Make/accept offer, native listing, sweep execution
- Strategy engine / Since You Were Here sophistication / watchlist alerts beyond localStorage
- Blob retirement (A7) after production SQL is stable
- `/api/health` pretty source labels
- Incomplete Railway service IDs in docs
- Fletcher full visual rebuild beyond trust/usability
- Identity collision tests for Gear `#68` (not needed if Gear is out of MVP)
- Printed Phenolic remaining `syncing` at ~53% metadata coverage (honest)

---

## Launch invariant score (today)

| # | Invariant | Today |
| --- | --- | --- |
| 1 | Production running intended SHA | **FAIL** (`fa1fad2` vs staging `280f73b`) |
| 2 | Web survives restart | Staging web up; not proven as launch candidate on prod |
| 3 | Worker independent | Staging/prod workers up; SHA pin incomplete |
| 4 | Postgres authoritative + consistent | Staging SQL reads yes; prod blob; disk incident |
| 5 | Supply 62093 | **PASS** both envs |
| 6 | Category membership | Staging materials/digits live except Phenolic coverage |
| 7 | Floors match OpenSea samples | Not re-sampled this report (do in DATA_ACCEPTANCE) |
| 8 | New listings latency | Stream connected; not timed this report |
| 9 | Cancel/sale reconcile | Writer failures 0; not sampled |
| 10 | Real single-NFT purchase | **FAIL** (flags off + SQL slug hole) |
| 11 | Transaction firewall | Prepare fail-closed; flags off; SQL slug blocks path |
| 12 | Homepage → buy → portfolio desktop/mobile | **FAIL** (SQL listTokens/account holes; no Buy E2E) |

---

## Highest-leverage order (does not reduce the bar)

1. **Architecture (this owner):** SQL collection-wide `listTokens`, honest account inventory, SQL `resolvedChainSlug`, single SQL `snapshotRevision`, stop false-zero category fallback.
2. **Docs:** `RAILWAY_RELEASE_AUDIT.md` + GHA worker SHA pin + set-variables runbook.
3. **UX:** search-by-token-id, portfolio labels, hide ungated money chrome.
4. **DATA_ACCEPTANCE.md** against staging SQL after (1).
5. **Human:** promote staging→main, A6 SQL on production, capacity headroom.
6. **Controlled staging Buy E2E** then `BUY_E2E.md`.
7. Fletcher-bounded polish.
8. `RELEASE_READINESS.md` → LAUNCH PASS or BLOCK.

## Trade-path audit (2026-09-10, flags off)

These are **P0 before `TRADING_ENABLED` may be flipped**. They are not an excuse to skip Buy E2E; they are why the flag stays off.

| ID | Symptom | Gate today |
| --- | --- | --- |
| P0-BUY-DRAWER | BuyDrawer omits `acceptedPriceRaw`; 400 once flags on | UI now hidden unless public trading flag |
| P0-BUY-RECEIPT | BuyDrawer treats tx hash as success; no `waitForTransactionReceipt` | Same |
| P0-BUY-CHAIN | `sendTransactionAsync` has no `chainId: 1311` | Same |
| P0-BUY-VALUE | ERC-20 USDG buy can still send native `msg.value` | Policy now rejects non-zero value when ERC-20 amount is set |
| P0-BUY-SWEEP | Master flag would enable sequential multi-buy via cart; Sweep UI ignored `SWEEP_ENABLED` | Sweep UI hidden unless `NEXT_PUBLIC_SWEEP_ENABLED` |
| P0-BUY-DECODE | Recipient is calldata substring; signed payload not ABI-decoded | Blocks flag-on until commerce track |
| P0-BUY-USDG | No allowance/approve step | Blocks real-money E2E |
| P1-CART-RAW | Revalidate uses OpenSea envelope; SQL has no `priceRaw`; null snapshot skips drift | Blocks public Buy |

`LIST_ENABLED` / `OFFER_ENABLED` now **default false**. Do not flip `TRADING_ENABLED` until P0-BUY-* plus a real receipt.

Do not enable production trading, sweep, offers, native listing, or Gear to make the report look greener.

---

## RED / human-approval (will not execute without you)

- Merge `staging` → `main`
- Production `MARKET_READ_MODEL=sql` (A6)
- Production `TRADING_ENABLED` / `BUY_ENABLED`
- `railway connect-service-source`
- Postgres restart on a full volume
- Destructive SQL rebuild (`MARKET_SQL_REBUILD_DESTRUCTIVE=1`)
