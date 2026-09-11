# Net Vision

Net Vision is a specialized marketplace and market-intelligence interface for Button Presser collectibles on Robinhood Chain.

Its organizing idea is simple: **the number itself can be a market.** Instead of treating Button Presser as one undifferentiated NFT collection, Net Vision lets collectors explore the collection through number length, official material, visible number patterns, and curated cultural groups, then see the marketplace activity attached to those groups.

The product's current positioning is:

> **The market for numbers.** Discover, collect, and trade Button Presser characters by number pattern, with active asks, category-level market data, and portfolio context in one interface.

## What Net Vision adds

General NFT marketplaces are optimized around collections and individual tokens. Button Presser has another useful dimension: collectors can care about groups such as 3 Digit numbers, Palindromes, Repeating Digits, Brass, Meme Numbers, or Years.

Net Vision makes those groups first-class **Categories**. A category can have its own members, active listings, floor, sales, offers, and market history without pretending that every category was defined by the original NFT collection.

That distinction matters. Some categories are official metadata. Others are deterministic interpretations of the Button number. Others are curated sets maintained by Net Vision. The interface preserves the source of each classification.

## What you can use today

### Discover markets

Browse the overall market or open the Categories directory to move directly into a number, material, pattern, or culture market. Category pages are designed as buying surfaces rather than static trait pages.

### Inspect individual Buttons

Token pages bring together a Button's identity, category memberships, marketplace state, price information, and commerce actions that are permitted by the current trading gate.

### Follow market activity

Net Vision surfaces active listings, recent sales, and read-only offers from its persisted market index. When the index does not yet have enough verified coverage to make a market metric authoritative, the interface says **Syncing market data** instead of turning unknown data into a false zero.

### View your portfolio

Connect a wallet to view Button Presser holdings in the portfolio surface. Net Vision is non-custodial: connecting a wallet does not give Net Vision possession of the wallet or its assets.

### Build a cart

Listings can be selected into a cart. The cart stores a listing snapshot and revalidates market state before executable trade preparation so stale price or order information cannot silently become a different user intent.

### Prepare a purchase

Net Vision contains a hardened buy-preparation path and transaction-policy checks. **Trading is fail-closed.** Whether an executable purchase is available depends on the deployment's trading gate and the required safety checks. The existence of a Buy button or preparation route should not be interpreted as a guarantee that production trading is enabled.

## Current scope

Net Vision currently focuses on **Button Presser** on **Robinhood Chain** and uses OpenSea as its external marketplace-data and order source. The current collection contract allowlisted by Net Vision is:

`0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2`

The official existing supply used for collection coverage is **62,093** Buttons. The discovery envelope extends through token ID 62,095 because the token-ID range itself is not treated as proof that every ID exists.

## Category families available now

Net Vision currently ships four customer-facing category families:

| Family | Meaning | Source |
| --- | --- | --- |
| Number | 1 Digit through 5 Digit | Derived from the Button display number |
| Material | Brass, Steel, Anodised Aluminium, Printed Phenolic | Official `Plate` metadata |
| Pattern | Palindromes, repeating structures, sequences, round numbers, and related forms | Deterministic Net Vision taxonomy |
| Culture | Sets such as Meme Numbers, Lucky Numbers, and Years | Versioned curated lists |

Future families such as game, rarity, equipment, season, and character are reserved in the architecture but are **not current public categories** and should not be described as shipped features.

## How to interpret market status

Net Vision distinguishes between a market being present and its data being sufficiently verified.

**Live** means the category has reached the required coverage threshold for its market metrics to be presented as authoritative. **Syncing** means the category is still being verified. A syncing category can still exist and contain known listings; Net Vision simply refuses to treat incomplete coverage as a complete market.

This is a core product principle: **unknown is not the same thing as zero.**

## What is gated today

The repository currently keeps sweep execution, offer acceptance, and native listing behind independent feature gates. Those capabilities should be documented as gated until their production flags, safety tests, and end-to-end verification establish them as available.

## Non-custodial by design

Net Vision does not request or store seed phrases or raw private keys, and the Net Vision server does not sign as the user. The connected wallet remains the final signing authority for any executable action.

See [Wallet, security, and trading](./security-and-trading.md) for the transaction-safety model.
