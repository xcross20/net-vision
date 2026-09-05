# Button Presser metadata facets

Official collection traits come from NFT metadata, not from token-id ranges and not from `classifyNumber()`.

## Plate (material)

OpenSea trait type: `Plate`

| OpenSea value | Normalized slug | Official count (OpenSea collection traits) |
| --- | --- | ---: |
| Brass | `material-brass` | 999 |
| Steel | `material-steel` | 4,000 |
| Anodised aluminium | `material-anodised-aluminium` | 15,000 |
| Printed phenolic | `material-printed-phenolic` | 42,094 |

Sum of official counts: **62,093**.

Membership rule:

```text
metadata.traits[trait_type == "Plate"].value == "Brass"
  => facet { family: material, slug: material-brass, source: metadata }
```

Case-insensitive trait type. Value matching is normalized (trim, collapse whitespace, British/American aluminium/aluminum, anodised/anodized). The original label is persisted on the facet.

Plate is treated as mutually exclusive until live metadata proves otherwise. If a token has two Plate values, persist both, skip the exclusivity assertion, and document the exception. Do not force one Plate.

## Forbidden

```text
tokenId <= 999 => Brass
1000..4999     => Steel
5000..19999    => Anodised aluminium
20000..62093   => Printed phenolic
```

Those ranges are a **QA cross-check only** (`qaPlateRangeHint` in tests). A mismatch is a recorded anomaly, not a membership override.

## Extraction

`extractMetadataFacets(metadata)` in `@net-vision/taxonomy`. It does not call `classifyNumber()`. Unknown Plate values are stored with `slug: material-unmapped` plus the original label; they do not join a shipped category.

## Indexing

Plate is attached when the indexer or a request path successfully fetches NFT metadata. Until then a token may be a 3 Digit member (derived) and still have **no** material facet. Brass listings therefore lag digits-3 listings during sync, which is correct.

## QA

- Fixture tokens with Plate=Brass are members of `material-brass` and not of other Plate slugs.
- Token `1` with no metadata is **not** Brass.
- `classifyNumber('777')` does not emit any `material-*` slug.
- Official counts are constants for directory expected supply; indexed member lists come only from extracted Plate facets.
