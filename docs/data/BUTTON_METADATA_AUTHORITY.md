# Button Presser metadata authority

**Date:** 2026-09-10  
**Collection:** Button Presser `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` on chain **4663**  
**Official universe:** **62,093** (`isOfficialExistingTokenId`). Discovery envelope 62094–62095 is **not** coverage.

## Ranked sources

| Rank | Source | Authority | Bulk | Reliability | Rate limits | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **`tokenURI(tokenId)` on the Button Presser contract** | Highest — on-chain | Yes: `eth_call` | High | Public RPC is rate-limited; use production RPC for the worker | RPC only |
| 2 | `baseURI()` | None — **reverts** | — | — | — | — |
| 3 | IPFS/HTTP metadata objects | N/A — URI is not ipfs:// | — | — | — | — |
| 4 | OpenSea collection NFT pagination | Mirror | Paginated | 429s | Strict | API key |
| 5 | OpenSea per-token NFT | Repair fallback only | No | 429s | Strict | API key |

## What tokenURI returns (live RPC)

Probed ids 1, 43, 999, 1000, 5000, 20000, 20343, 43866, 62093:

```text
data:application/json;base64,<json>
```

JSON fields: `name`, `description`, `attributes[]`, `image`.

`image` is `data:image/svg+xml;base64,<svg>` — official plate art is **on-chain**, not OpenSea CDN.

`baseURI` and `contractURI` revert.

Phantoms 62094 and 62095 also return tokenURI data. They **must not** enter canonical coverage.

## Identity invariant

```text
token_id == Presser trait numeric value == "Button Presser #{token_id}"
```

Conflict → `IDENTITY_BLOCK`. Do not silently rewrite.

Official attributes (source=`metadata` / `contract-token-uri`):

- Presser
- Plate (Brass / Steel / Anodised aluminium / Printed phenolic)
- Stamping (Hand struck / Machine set)

Derived Net Vision facets (digits, palindrome, repeats, culture) stay in `token_facets` with `source=derived|curated`. Never labeled official.

## Implication

The 62,093-token bootstrap is an **RPC walk of tokenURI**, not 62,093 OpenSea NFT GETs. OpenSea remains listing/sale/stream authority only.
