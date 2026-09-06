# RISK MAP: Market Data Architecture V2 + staging

**Date:** 2026-09-06  
**Specs:** `SPEC_MARKET_DATA_ARCHITECTURE_V2.md`, `SPEC_STAGING_ENVIRONMENT.md`

Risk = probability × cost × **invisibility**. Ranked scenarios, not categories.

## Architecture / A1

1. **Staging (or a mistaken `main` merge) applies A1 DDL against production Postgres while the walker is mid-tick, and a `CHECK`/`NOT NULL` fails or locks `tokens`.**  
   P:M Cost:H Invisibility:M  
   Mitigation: additive DDL only; do not drop PKs; A1 ships on `feat/sql-market-read-model` → `staging`, never straight to `main`.  
   Test: idempotent SQL; constraint names gated `IF NOT EXISTS`.  
   Tripwire: production `/api/v1/health/indexer` `workerOnline` false or `heartbeatAgeMs > 60_000` after any schema deploy — revert the worker image; DDL rollback is expand-only (columns stay).

2. **A1 drops `token_id` PKs while `upsertNormalized` still `ON CONFLICT (token_id)`, crashing the first normalized save and silently stopping recovery projection.**  
   P:H if we swap PKs now Cost:H Invisibility:H (blob path still green)  
   Mitigation: **do not drop old PKs in A1.** Unique composite indexes only.  
   Test: schema SQL still contains the v1 `PRIMARY KEY` on `token_id`; A1 SQL does not `DROP CONSTRAINT` on those PKs.  
   Tripwire: worker logs `[index/pg] normalized upsert failed` — A2 must fix writers before PK contract.

3. **`token_facets` and `token_categories` remain two independent membership truths; A4 queries one, UI the other, Brass listed count forks.**  
   P:H without an invariant Cost:H Invisibility:H  
   Mitigation: comments + `FACET_OWNERSHIP` constant; A2/A4 must derive categories from facets.  
   Test: constant asserts canonical vs derived; SQL comments present.  
   Tripwire: A3 parity — Brass SQL count ≠ blob count at same revision.

4. **`collection_id` default silently attributes a future Gear token to Button Presser.**  
   P:L until Gear Cost:H Invisibility:H  
   Mitigation: seed only Button Presser; block second collection until A2 writers pass `collection_id` explicitly; no default-based inserts in A2.  
   Test: seed row count for `collections` is 1.  
   Tripwire: `SELECT count(*) FROM collections` > 1 before A2 complete → BLOCK Gear.

5. **`listing_state` CHECK rejects a legacy row (`listed` vs `LISTED`), `ensureSchema` throws, worker dies on boot.**  
   P:L Cost:H Invisibility:L (boot crash is loud)  
   Mitigation: add CHECK in a DO block; if it fails, skip and log — actually **fail loud** on staging, do not skip. Production does not run A1 yet.  
   Test: CHECK lists the four states from `LISTING_STATES`.  
   Tripwire: worker boot loop on staging after A1 deploy.

## Staging

6. **Staging `DATABASE_URL` resolves to production Postgres; staging worker writes Gear-era schema or empty rebuilds into production.**  
   P:M on naive duplicate Cost:H Invisibility:H  
   Mitigation: after env create, compare hostname of staging vs production `DATABASE_URL`; refuse to deploy worker if equal.  
   Test: manual spike (ops), recorded in `docs/deploy/STAGING.md`.  
   Tripwire: same hostname → stop, provision new plugin.

7. **`connect-service-source(branch=staging)` retargets production web/worker off `main`.**  
   P:M Cost:H Invisibility:M  
   Mitigation: never call that tool to set staging branch; per-environment branch only.  
   Tripwire: production deploy starts from a non-`main` SHA — rollback source to `main`.

8. **Two workers share one OpenSea key and staging starves production with 429s.**  
   P:M once staging worker is indexing Cost:M Invisibility:M  
   Mitigation: A1 staging worker can run (schema apply on boot) but coverage walk is production-priority; if `last429At` advances on production after staging worker starts, pause staging worker.  
   Tripwire: production `last429At` advancing plus `walkerTokensPerMinute` drop.

## Clean zones

- Wallet/trading code (untouched; staging flags off).
- UI/visual rebuild.
- Coverage math and listing-state machine (TypeScript unchanged).
- Blob request path (A1 does not read SQL on the web).

## Spike required

**Staging DATABASE_URL isolation.** Experiment: create env, list rendered `DATABASE_URL` for staging web and production web, compare hosts. Result: recorded in the staging runbook before the staging worker is allowed to stay up.

## Budget

Deep care on items 1, 2, 6, 7. Speed on docs, comments, unique indexes, seed rows.
