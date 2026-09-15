# Net Vision — Launch Candidate

**Candidate SHA:** `9d52d7d59ca5c8e2b711f8ae44e63f91f68c205d` (release/promote-staging-to-main)
**Promotion path:** `staging` → `main`
**Production posture:** **fail-closed** — only Buy ships enabled; every other trading surface stays OFF until manually flipped.
**Headline:** promote the code, not the capabilities.

---

## 1. What's in this candidate

| Range | Commits | Source |
| --- | --- | --- |
| `origin/main` (today) | `fa1fad2` | current production commit |
| `origin/staging` (pre-safety) | `20ec17f` | tip after PR #51 (canonical metadata backfill 100%) |
| `release/promote-staging-to-main` (this PR) | `9d52d7d` | staging tip + 3 release-safety commits |

**80 commits** total land on `main` if this PR merges:

1. **77 commits** between `origin/main` and `origin/staging` (cart sweep fix, watchlist hearts, native listings + sweep-offers, bigint serialization, watchlist headers, coverage tracker, canonical metadata bootstrap + repair loop).
2. **3 safety commits** on top of staging (see §2).

---

## 2. Release-safety commits (this PR)

| SHA | Subject | Purpose |
| --- | --- | --- |
| `c48004b` | `fix(trade): fail-closed defaults for non-Buy trading surfaces` | `LIST_ENABLED` and `OFFER_ENABLED` now default to `false`. Only Buy remains default-on because Buy is the only surface with full E2E PASS. New 13-test `kill-switch.test.ts` pins the behavior. |
| `be094fd` | `fix(api): guard every mutating trade route with the kill switch` | Sibling-risk search found 10 mutating trade routes had no `isSurfaceEnabled()` guard. Added guards to `list/prepare`, `offers/prepare`, `offers/submit`, `offers/[offerId]/cancel`, `offers/[offerId]/accept/prepare`, `offers/[offerId]/fill/confirm`, `offers/bulk/prepare`, `offers/bulk/submit`, `trade/offers/bulk/plan`, `categories/[slug]/sweep-preview`. Read-only routes (`offers` list, `asset-status`, `cart/revalidate`, `usdg-status`) intentionally unguarded — they serve market data, not actions. |
| `9d52d7d` | `fix(app): add root error boundary so operators see a coherent recovery UI` | New `apps/web/app/error.tsx` with "Market data temporarily unavailable" copy, retry button (`reset()`), home link, and error digest for Railway log correlation. |

Each commit is independently revertible; kill-switch defaults can be overridden per env without code changes.

---

## 3. Test / feature matrix (reviewer template)

| Surface | Evidence | Status |
| --- | --- | --- |
| **Market data (read-only)** | 77 commits of catalogue/indexer/categories hardening. `TokenCatalog` is the single read model. Stale paths (`STALE`) are excluded from `listedVerified`. OpenSea 429 falls back to worker index without fabricating zeros. | **PASS** |
| **Worker** | Staging worker deployed at Railway deployment `d075e350-2373-454b-809a-b48950537c8e` [SUCCESS] on commit `20ec17f`. 17 env vars including `INDEXER_V2_ENABLED`, `MARKET_INDEX_WRITER`. Old worker (`852a6cfc`, frozen at `deff1a5` since 2026-09-10) marked REMOVED. | **PASS** |
| **Metadata cache coverage** | 62,093 / 62,093 verified + 62,093 / 62,093 images cached at 23:39 UTC 2026-09-12. Heartbeat fresh. Spot-checked tokens 1, 100, 5000, 25000, 45000, 62000, 62093 — all serve real cached Plate SVGs. `/coverage` page renders with progress bars + ETA + 9 stats + `data-testid="coverage-status"`. | **PASS at 100.00%** |
| **Wallet / network authority** | EIP-6963 multi-injector detection; chain config (`@net-vision/chain-config`) is the single source of `chainId`, RPC URLs, contract addresses, payment tokens. Robinhood Chain 4663, Seaport `0x0000000000000068F116a894984e2DB1123eB395`, USDG `0x5fc5360d0400a0fd4f2af552add042d716f1d168`. Wallet intent is decoded calldata + policy, never user-supplied fields. | **PASS** |
| **USDG Buy E2E** | `docs/launch/USDG_BUY_E2E.md` documents the full path. Buy is the only surface with a complete end-to-end PASS through Seaport fulfillment, simulation, and policy firewall. | **PASS** |
| **Portfolio** | Decoded holdings + wallet-derived USDG balance; no fabricated totals. `/portfolio` reads from `TokenCatalog` and live chain state with same-revision guard. | **PASS** |
| **Mobile smoke** | Existing responsive layout verified at the visual rebuild checkpoints; not a separately-tracked path in this PR (no mobile-specific changes). | **PASS (no regression)** |
| **Error / degraded states** | Root `app/error.tsx` added in `9d52d7d` renders a coherent recovery UI on render failures. Network errors already surface as inline section errors. `tradingDisabledResponse` returns `{error: 'trading_temporarily_disabled', surface, message}` on 503. | **PASS** |

**Build/test signals:**

- `apps/web` typecheck clean (`npx tsc --noEmit`)
- 50 vitest files / **321 tests** passing locally
- `lib/trade/kill-switch.test.ts` adds 13 new tests pinning the fail-closed defaults
- `@net-vision/transaction-policy` package tests pass

---

## 4. Production surfaces — ON / OFF plan

This PR does **not** flip any production env vars. Promotion of code is a prerequisite for promotion of capabilities, but the capability promotion must be a separate, deliberate step.

| Surface | Env var | Production state after PR merge | Notes |
| --- | --- | --- | --- |
| Buy | `TRADING_ENABLED`, `BUY_ENABLED` | **OFF today; OFF after merge** | Production has zero trading env vars set → `isTradingEnabled()` returns false → every surface refuses. Post-merge remains OFF. |
| List | `LIST_ENABLED` | **OFF today; OFF after merge** | Default flipped to `false` in `c48004b`. Set `LIST_ENABLED=true` in production to enable (requires explicit `LIST_OFFER_REVIEW_PASSED=true` go-decision). |
| Offer | `OFFER_ENABLED` | **OFF today; OFF after merge** | Default flipped to `false` in `c48004b`. |
| Sweep | `SWEEP_ENABLED` | **OFF today; OFF after merge** | Default already `false`. Sweep requires full listing completeness + cart execution PASS. |
| Accept offer | `ACCEPT_OFFER_ENABLED` | **OFF today; OFF after merge** | Default already `false`. Disabled until Seaport offer extraction matches buy-path hardening. |

**Recommended production env plan after merge:**

1. **Stage 1 (immediate, this PR):** No env changes. Production stays read-only — market data, categories, listings, activity, portfolio all visible. All trading surfaces 503.
2. **Stage 2 (separate, requires full E2E re-verification on prod):** Set `TRADING_ENABLED=true` and `BUY_ENABLED=true`. Everything else stays off. Verify buy E2E against mainnet using staging's `prepare` semantics.
3. **Stage 3 (later):** Enable List (`LIST_ENABLED=true`) only after a fresh E2E pass on prod.
4. **Stage 4 (later):** Enable Offer / Sweep / AcceptOffer, each with its own E2E pass and recovery proof.

The code defaults ensure the platform cannot accidentally turn into a full-feature marketplace by missing a flag.

---

## 5. Pre-merge gate (what must be true before clicking merge)

- [x] `release/promote-staging-to-main` builds clean and passes `check` (CI green)
- [x] `kill-switch.test.ts` pins the fail-closed defaults
- [x] All 12 mutating trade routes call `isSurfaceEnabled()` (sibling-risk search complete)
- [x] Root `app/error.tsx` renders without throwing
- [x] `/api/v1/health/coverage` returns `complete=true, completePercent=100.00` on staging at `20ec17f`
- [ ] **Last live confirmation:** reviewer / founder inspects `https://www.netsvision.io/` is on commit `fa1fad2` and behaving correctly **before** clicking merge

---

## 6. Rollback plan

- **Rollback SHA (production today):** `fa1fad243116b27a72169b35908b17d2dc3c5f1e` (current `main`).
- **Procedure:** if production misbehaves after merge, `git revert -m 1 <merge-sha>` or `git reset --hard fa1fad2 && git push --force-with-lease origin main`. Railway will redeploy both web and worker on the next push.
- **Per-commit revertibility:** each safety commit touches a small, isolated surface. `git revert c48004b` flips back kill-switch defaults; `git revert be094fd` removes guards; `git revert 9d52d7d` removes the error boundary. None require a database migration.
- **Kill-switch override (no code change):** `TRADING_ENABLED=false` on production web shuts every surface in <1s; Railway will hot-restart the web service.

---

## 7. Production Railway state snapshot (2026-09-12)

**Project:** `net-vision` (`df70d7dc-8293-4b29-979f-a89591fd9df3`)
**Environment:** production (`138cf108-b3f7-4393-b9f1-0d6e4e83ab7d`)

| Service | ID | Last deploy | Commit | Status |
| --- | --- | --- | --- | --- |
| web | `213d9499-c2e1-4915-90d4-c1eede9fd641` | `a31eabfc-f2b2-4dea-852a-2d8167a550a3` (2026-09-06) | `fa1fad2` (main) | SUCCESS |
| market-worker | `d1986b57-20c2-4258-a8b9-03ff4387805d` | — | `fa1fad2` era | running |
| Postgres | `5bad0f32-43f6-4622-b248-9f41ababfd97` | — | — | healthy |

**Production web env vars (6):** `DATABASE_URL`, `INDEXER_EMBEDDED`, `INDEXER_IN_WEB`, `INDEXER_V2_ENABLED`, `INDEX_DB_PATH`, `OPENSEA_API_KEY`.
**Production worker env vars (17):** `DATABASE_URL`, `INDEXER_EMBEDDED`, `INDEXER_V2_ENABLED`, `MARKET_INDEX_WRITER`, `OPENSEA_API_KEY`, `OPENSEA_COLLECTION_SLUG`, `PORT`, `RAILWAY_*`, `WORKER_ID`.

**No `TRADING_ENABLED` / `BUY_ENABLED` / `LIST_ENABLED` / `OFFER_ENABLED` / `SWEEP_ENABLED` / `ACCEPT_OFFER_ENABLED` set** → production is safe-by-omission today; every surface refuses.

**Domains:** `www.netsvision.io` + `web-production-38d29.up.railway.app`.

---

## 8. After merge — staging deployment sequence

1. The release PR merges into `main`.
2. **Do not trigger a Railway production deploy by hand.** Production web is pinned to GitHub source for `main`. The first push to `main` after this PR will trigger Railway auto-deploy of both web and worker.
3. The deploy SHA must equal `9d52d7d`. Verify on Railway dashboard before the deploy proceeds.
4. After deploy: re-check `https://www.netsvision.io/api/v1/health/indexer` and `/api/v1/health/coverage` to confirm metadata coverage remains 100% and worker heartbeat is fresh.
5. Spot-check 5 random tokens for `content-type: image/svg+xml` from `/api/v1/tokens/[id]/media` or equivalent.
6. Confirm every `/api/trade/*` and `/api/offers/*` mutating route returns 503 with `trading_temporarily_disabled` (production env has no flags → all surfaces off).

---

## 9. What this PR deliberately does NOT do

- Does not change `origin/main` env vars on Railway.
- Does not enable Buy on production.
- Does not delete the stashed WIP branches (Requests A–D work — see git stash). Those are separate deliverables for the next sprint and require their own PRs.
- Does not delete any superseded PRs (see §10).
- Does not enable listing, offer, sweep, or accept-offer on production. Each is gated separately.

---

## 10. Stale / superseded PRs to close after merge

These PRs are superseded by this release PR. Closing them with a pointer comment keeps the PR list clean. They will be closed **after** this release PR merges, not before.

- #18
- #19
- #21
- #25
- #39
- #42

Pointer comment template: `Superseded by the staging → main release PR; tracking moved there.`