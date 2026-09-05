# Category Market V2

Status: **binding implementation contract.** Every category is its own live market. Taxonomy, commerce, analytics, and portfolio all join on the same Category object.

This document does not replace `docs/data/MARKET_INDEXER_V2.md`. Indexer V2 remains the marketplace-state layer. Category Market V2 is the facet + category-market layer that sits on top of it.

## Core rule

A Button Presser can belong to many Net Vision categories. Those memberships do **not** share a source of truth.

| Layer | Question | Source of truth |
| --- | --- | --- |
| Token Registry | Which NFTs exist? | OpenSea NFT records + `exists` on the persisted registry. Never “every integer in `1..maxTokenId`”. |
| Official metadata facets | What did the collection assert? | NFT metadata traits. Plate is the first official family. |
| Derived numeric facets | What does the Button number look like? | `@net-vision/taxonomy` `classifyNumber(displayNumber)` |
| Curated facets | What cultural sets do we maintain? | Versioned curated lists in the taxonomy package |
| Future game facets | What does official NET game metadata say? | Not ingested until that metadata exists. Types are reserved only. |
| Marketplace state | Listed / unlisted / stale / sold / offered | Indexer V2 4-state model. Unknown is not unlisted. |

These layers are merged at query time. They are never flattened into one classifier.

**3 Digit is our interpretation of the number. Brass is a fact asserted by the NFT's official `Plate` metadata.** They remain independent markets even when membership currently overlaps.

## Forbidden inferences

Do not implement any of the following, even if they match today's collection:

```text
tokenId <= 999            => Brass
digits-3                  => Brass
Palindrome                => lucky
no local listing          => unlisted
1..maxTokenId             => the token exists
current OpenSea snapshot  => historical volume
```

Number-range hints for Plate may appear in QA only. They must not determine membership.

## Facet families

Shipped:

```text
number     derived from display number
material   official Plate metadata
pattern    derived structure / sequence / math
culture    curated lists
```

Reserved, not populated:

```text
game
rarity
equipment
season
character
```

Do not invent Netgear semantics.

## Source values

```text
metadata | derived | curated | game
```

`classifyNumber()` must not grow Plate logic. Plate extraction lives in `extractMetadataFacets()`.

## Category catalog families (customer-facing)

Number: 1 Digit … 5 Digit (`digits-1` … `digits-5`)

Material: Brass, Steel, Anodised Aluminium, Printed Phenolic
(`material-brass`, `material-steel`, `material-anodised-aluminium`, `material-printed-phenolic`)

Pattern: Palindromes, Repeating Digits, Doubles, Triples, Quads, Bookends, Alternating, Ascending, Descending, Mirror Sequences, Round Numbers, Binary Style

Culture: Meme Numbers, Lucky Numbers, Years

Customer copy is **Categories**. Do not call the directory “algorithmic markets”; Material is official metadata.

## Marketplace independence

Listing state is `UNKNOWN | LISTED | UNLISTED_VERIFIED | STALE` (see Indexer V2).

A category listing is:

```text
registry.exists
AND facet membership for that slug
AND listing_state == LISTED
```

Incomplete coverage renders **Syncing market data**. It never renders a silent 0.

## Sales attribution

A sale of token T at price P updates every category T belonged to **at sale time**. Persist those slugs on the sale. Later taxonomy edits must not rewrite history.

Category volumes are overlapping analytical figures. Never sum them into global volume.

## Commerce

`/categories/:slug` is the buying surface. Default tab is Listings.

Selection feeds the existing cart. Sweep (cheapest N / spend cap / max per item) creates a cart basket. There is no second checkout.

Sweep, category alerts, category bids, and Value Sweep stay disabled while `marketStatus === 'syncing'`.

## History honesty

Tracked metrics are labeled `Tracked since <historyStartedAt>`. Do not backfill OpenSea history we did not persist.

## Definition of done

See the implementation directive in the originating plan. The short version: sources stay separate, one NFT can belong to many categories, each category is a market, incomplete index never looks like zero, Netgear can plug in later without rewriting Button taxonomy.
