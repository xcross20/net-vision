# Authority Map

Project: Net Vision (Helix)
Current epoch: **E2 — Normalized SQL is staging market read authority**
Updated: 2026-09-09
Base SHA: `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a` (`origin/staging`, PR #17)

A5 PASS on staging. Production remains blob until A6. A6 is blocked until product tracks prove on SQL-backed staging.

| Authority | Canonical source | Current owner | Active mutation track | Consumers | Risk | Notes |
|---|---|---|---|---|---|---|
| Official supply | Plate `officialExistingSupply` = 62093 | architecture (frozen) | none | collection pulse, categories, SQL universe | RED | Discovery envelope #62094/#62095 is not supply. `tokens.exists` is metadata. |
| Market listing state | `token_market_state.listing_state` | architecture (frozen) | none | SQL reads, portfolio, commerce | RED | LISTED / UNLISTED_VERIFIED / STALE / UNKNOWN. UNKNOWN ≠ unlisted ≠ zero. |
| Collection / category floor | Lowest **LISTED** ask in SQL | architecture (frozen) | none | pulse, `/categories`, detail, listings | RED | STALE siblings must not blank a LISTED floor. Stale-only → `lastKnownFloor`. |
| Bootstrap completeness | `bootstrapCoverage` (established / expected ≥ 0.95 → live) | architecture (frozen) | none | `marketStatus` | RED | Established = LISTED \| UNLISTED_VERIFIED \| STALE. Not TTL-fresh. |
| Realtime health | worker heartbeat + stream | architecture (frozen) | none | freshness, pulse | RED | Distinct from bootstrap. Offline must not fabricate zeros or hide known LISTED. |
| SQL writer / event order | `market_events` → per-token upsert | architecture (frozen) | none | worker | RED | `MARKET_SQL_WRITER`, projectionFailures tripwire. |
| Reconciliation high-water | worker checkpoint + `state_event_id` | architecture (frozen) | none | worker | RED | Do not rebuild by full DELETE. Destructive rebuild gated. |
| Staging read-model selection | `MARKET_READ_MODEL=sql` staging web+worker | architecture (frozen) | none | web request path | RED | Production unset = blob. Do not flip production (A6). |
| Blob checkpoint | `index_blob` / in-memory `IndexSnapshot` | architecture (frozen) | none | worker dual-write, `/api/health` liveness | YELLOW | Not request-path authority on staging. Retire in A7. |
| Category membership | `token_facets` + taxonomy | architecture (frozen) / Gear adds Gear facets | Gear may add Gear-only facets | categories, Gear | YELLOW | Button membership stays Plate/taxonomy. No invented Gear traits. |
| Asset identity | `{ ecosystemId, collectionId, tokenId }` | modularity contract | Portfolio owns generic identity usage | all product tracks | YELLOW | Token id alone is forbidden in generic code. |
| Transaction policy | `packages/transaction-policy` | Commerce | `feat/commerce-hardening` | checkout | RED for execution | Offer/sweep/native listing stay gated. |
| Collection registry | `@net-vision/chain-config` | Gear (additive) | `feat/netnet-gear-foundation` | portfolio, token routes | YELLOW | Do not change Button supply or contract. |
| Fletcher visual system | existing UI + Fletcher spec | Launch QA (visual only) | `feat/launch-readiness` | all pages | GREEN | No readiness math in components. |

## Epoch E2 contract (frozen)

```text
Normalized SQL = staging market read authority
Blob = checkpoint / recovery / production-until-A6
```

Feature workers may **consume** these contracts. They may **not** independently modify:

- `apps/web/lib/index/sql-read-flags.ts`
- `apps/web/lib/index/sql-category-queries.ts`
- `apps/web/lib/index/market-read-repository.ts`
- `apps/web/lib/market/sql-market-source.ts`
- `apps/web/lib/market/sql-readiness.ts`
- `apps/web/lib/index/sql-writer.ts`
- `apps/web/lib/index/pg.ts`
- `apps/web/lib/index/store.ts` (except Launch QA tests that only read)
- `apps/web/lib/index/schema-v2.ts`
- `apps/web/lib/index/canonical-universe.ts`
- `apps/web/lib/market/open-sea-source.ts` (`getMarketSource()` branch)
- `apps/market-worker/**`
- Railway `MARKET_READ_MODEL` / `MARKET_SQL_*`

## Known residual (not a product-track fix)

Staging categories/listings APIs still stamp blob `snapshotRevision()` from `lib/index/store.ts`, while collection snapshot uses SQL `establishedCount`. Facts are SQL; the revision **label** is mixed. Do not treat blob revision as a shared SQL snapshot id. Architecture may fix this later; product tracks must not “correct” it by patching UI.

Printed Phenolic `marketStatus=syncing` is real metadata coverage (~0.53), not the old TTL bootstrap defect.

## Authority collision check

- [x] No authority has more than one active mutation track.
- [x] Every consumer track knows which contract it consumes.
- [x] RED authorities require explicit human approval (A6 production SQL, A7 blob retirement, destructive SQL rebuild, production writes).
