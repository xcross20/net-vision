# Categories and Number Markets

Categories are the core organizing system in Net Vision. They turn meaningful groups of Button Presser NFTs into explorable market surfaces with members, listings, floor data, sales, offers, and category-level analytics.

A single Button can belong to multiple categories at the same time. That is expected. A Button might be `3 Digit`, `Brass`, a `Palindrome`, and part of a curated cultural set without any of those labels replacing the others.

## The four current category families

### Number

Number categories are derived from the Button's display number. The current directory includes **1 Digit, 2 Digit, 3 Digit, 4 Digit, and 5 Digit** markets.

These categories answer a structural question: how many digits does the collectible number contain?

### Material

Material categories are based on the official Button Presser metadata trait named `Plate`. Net Vision currently recognizes:

| Material | Official expected supply |
| --- | ---: |
| Brass | 999 |
| Steel | 4,000 |
| Anodised Aluminium | 15,000 |
| Printed Phenolic | 42,094 |
| **Total** | **62,093** |

Material membership comes from metadata. Net Vision does **not** infer Brass, Steel, or another material merely from the token number or a token-ID range.

This is deliberate. A range can be a useful QA cross-check, but it is not the authority for an official collection trait.

### Pattern

Pattern categories are deterministic interpretations of the visible number. The current catalog includes markets such as:

- Palindromes
- Repeating Digits
- Doubles
- Triples
- Quads
- Bookends
- Alternating
- Ascending
- Descending
- Mirror Sequences
- Round Numbers
- Binary Style

Pattern membership is calculated by the versioned Net Vision taxonomy. Given the same display number and taxonomy version, the classifier should return the same result.

### Culture

Culture categories are curated sets maintained by Net Vision. Current examples include **Meme Numbers, Lucky Numbers, and Years**.

A curated category is not presented as an official Button Presser trait. Its value comes from making a collector-defined or culturally meaningful group easy to discover and trade while preserving the fact that Net Vision curated the group.

## Official, derived, and curated are different claims

Net Vision intentionally exposes the origin of a category instead of flattening all traits into one label system.

For example:

- `Brass` means the NFT metadata says its `Plate` is Brass.
- `3 Digit` means Net Vision's taxonomy observes a three-digit display number.
- `Palindrome` means that display number satisfies Net Vision's deterministic palindrome rule.
- A cultural category means the number appears on a maintained curated list.

A present-day overlap between two groups does not make them semantically interchangeable.

## Category market data

Each category can surface market metrics such as:

- member count;
- verified marketplace coverage;
- active listed count;
- listed percentage;
- floor price;
- recent sales;
- highest or notable sales;
- offers where supported by the read model; and
- tracked category volume.

Because one token can belong to multiple categories, **category volumes overlap**. A sale can correctly contribute to several category histories at once. Category volumes therefore must not be added together to calculate global collection volume.

## Membership at sale time

When Net Vision attributes a sale to categories, the relevant category memberships should be preserved with the sale event. A later taxonomy change should not silently rewrite the historical meaning of a sale.

This makes category history auditable: the market record reflects how Net Vision classified the Button when the event occurred.

## Live versus Syncing

Marketplace coverage is independent from category membership.

A category can have known members before Net Vision has verified the marketplace state of every member. While coverage is incomplete, the category reports **Syncing market data** rather than presenting an incomplete listing count or floor as authoritative.

The current market contract uses **95% verified coverage** as the threshold for a market to be presented as Live.

The important semantic is not the exact percentage by itself. It is the rule behind it: **Net Vision does not convert unknown marketplace state into an unlisted token or a zero floor.**

## Category pages are market pages

`/categories/:slug` is intended to be a transaction-oriented market surface. The default experience centers active listings and market information, with the category definition providing context for why those Buttons belong together.

The same cart and checkout model is reused across the market. Net Vision does not create a separate, category-specific checkout system.

## Future category families

The architecture reserves space for `game`, `rarity`, `equipment`, `season`, and `character` facets. Those names are extension points, not shipped claims. Until authoritative data exists and the product implements those families, they should remain absent from public feature descriptions.
