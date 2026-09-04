# Legacy ENS Vision Interaction Reference

This document translates the compact ENS Vision interaction model into NetNet branding for Net Vision. It is a reference for the UX team, not a marketing brief.

## The pattern

ENS Vision was a focused marketplace for ENS names. Its strength was density and clarity: a single screen showed the asset, the current ask, the owner, and the action. Filters were deep but the page above the fold always answered three questions: what is it, what does it cost, who owns it.

Net Vision applies the same pattern to Button Presser numbers.

## What we keep

- **Asset above the fold.** Image, current ask, owner, primary actions (Buy Now, Make Offer, Add to Cart) all visible without scrolling on mobile.
- **Marketplace source badges.** A listing row shows where it lives (Net Vision native orderbook vs OpenSea). The badges are visually identical so collectors do not learn two metaphors.
- **Compact data labels.** Floor, listed percent, member supply, and volume render as small mono labels rather than large hero numbers.
- **Filter density.** Multi-select structural and cultural traits, listed-only toggle, min/max price, owner address.

## What we adapt for numbers

- **No name field.** The token number is the asset identity. We render it as a large mono numeral.
- **Trait chips replace ENS attributes.** Each number gets deterministic structural and cultural traits from `@net-vision/taxonomy`.
- **Categories replace categories-of-names.** Algorithmic virtual collections (Palindromes, Meme Numbers, etc.) replace curated name lists.
- **Sweep replaces bulk buy by letter length.** A user picks a virtual collection, sets max spend and item count, and previews the basket.

## What we explicitly do NOT inherit

- The ENS Vision visual identity. Net Vision uses the NetNet dark financial-terminal palette (`@net-vision/ui` tokens).
- ENS-specific copy. We do not say "name", "registrar", or "expiry" anywhere in the UI.

## Open questions

- Should the Add to Cart action exist in Net Vision? For an MVP focused on buy and sweep, it adds UI surface without clear demand. It is in the spec but disabled in the slice.
- Should sweep preview be a modal or a dedicated page? The spec calls for a sweep drawer; we will implement it once the sweep flow is unblocked.
