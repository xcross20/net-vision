# OpenSea collection-listings cursor

**Verdict: the `next` cursor loops the same 200 orders.** This is OpenSea API behavior, not a Net Vision wrapper bug.

## Probe (2026-09-05)

`GET /api/v2/listings/collection/button-presser/all?limit=200`

| | page 1 | page 2 (`cursor=page1.next`) |
| --- | --- | --- |
| count | 200 | 200 |
| unique order hashes | 200 | 200 |
| first hash | `0x904af934…448c7e` | identical |
| last hash | `0x7427df86…eaf449` | identical |
| `next` | same base64 cursor | same base64 cursor |

Overlap: 200/200. Pages identical. `cursorRepeated: true`.

The request used the documented `cursor` query parameter against the raw OpenSea host with the production API key. No Next.js fetch cache was involved.

## Implication

Full orderbook completeness **must not** depend on collection-listings pagination. The listing reconciliation worker (`getBestListing` per token) is the coverage path. The 200-order window remains a cheap hint, never the source of truth.
