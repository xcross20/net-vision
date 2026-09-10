# Button Presser metadata bootstrap acceptance

**Verdict: METADATA BOOTSTRAP BLOCK** (2026-09-10)

Architecture and source authority are proven. The official universe does **not** yet have 62,093 explicit canonical rows in Postgres.

## Required

| # | Requirement | Result |
| --- | --- | --- |
| 1 | Official universe = 62,093 | **PASS** — `isOfficialExistingTokenId` |
| 2 | Source hierarchy documented | **PASS** — `docs/data/BUTTON_METADATA_AUTHORITY.md`; live `tokenURI` is data: JSON+SVG |
| 3 | Canonical table + checkpoint + failures | **PASS** in schema `metadata-bootstrap-v1` |
| 4 | Identity: tokenId == Presser == name | **PASS** unit tests; mismatch is IDENTITY_BLOCK |
| 5 | Phantoms 62094/62095 excluded from coverage | **PASS** unit tests |
| 6 | Coverage buckets sum to 62,093 | **PASS** formula in `readCanonicalCoverage` |
| 7 | Worker resumes after last_token_id | **PASS** unit (`31422 → 31423`) |
| 8 | Shards disjoint and complete | **PASS** 4-shard enumeration test |
| 9 | Listing event path skips OpenSea NFT GET when VERIFIED | **PASS** in metadata walker callback |
| 10 | Derived facets not labeled official | **PASS** — Plate via `extractMetadataFacets` source=metadata; digits remain derived |
| 11 | Honest pending image, no fabricated Plate | **PASS** `/api/media/canonical` |
| 12 | 62,093 explicit rows in staging/prod Postgres | **BLOCK** — crawl not finished |
| 13 | metadataCoveragePct = 100 | **BLOCK** |
| 14 | No transaction-authority changes | **PASS** |

## PASS when

Every official id has an explicit canonical status, verified+missing+invalid+retry+identityBlock+unknown = 62093, market events do not fetch metadata synchronously, and listing a previously unlisted token renders pre-cached official art.

Until then: **METADATA BOOTSTRAP BLOCK**.
