# Net Vision Public Documentation

> **Status:** Draft public documentation source.
>
> This directory is the source copy for the future Net Vision documentation site. It is intentionally separate from the repository's engineering specifications, ADRs, QA plans, operator runbooks, and agent instructions.

## What these docs are for

Net Vision needs one public place where a collector, trader, partner, or developer can understand what the product does, where its market data comes from, how categories work, what a wallet is being asked to sign, and which capabilities are live versus still gated.

The public documentation must describe the product that exists now. It must not turn planned features into implied promises.

## Documentation status language

Every capability that can move money or materially change product behavior should use one of these labels:

- **Available** — implemented and intended for normal user use.
- **Gated** — implemented in whole or in part, but disabled unless an explicit production gate is enabled.
- **Syncing** — data exists but has not reached the coverage threshold required to present it as authoritative.
- **Future** — reserved or planned, but not part of the current product contract.

## Current public-docs scope

The first public release should cover:

1. [Overview](./overview.md)
2. [Categories and number markets](./categories.md)
3. [Market data and freshness](./market-data.md)
4. [Wallet, security, and trading](./security-and-trading.md)

Additional pages should be added for the Button Presser collection, token pages, portfolio, cart and checkout, activity, OpenSea integration, FAQs, glossary, troubleshooting, and release notes.

## Current product contract

At the time of this draft, Net Vision is a specialized Button Presser marketplace and analytics terminal on Robinhood Chain. Its current product surface includes category markets, active listings, sales, read-only offers, token pages, a wallet-connected portfolio, a cart, and hardened buy preparation. Market state is maintained by an always-on indexer backed by Postgres.

Sweep execution, offer acceptance, and native listing remain independently gated. Live trading itself is fail-closed and must not be documented as universally available merely because the preparation flow exists.

## Source-of-truth policy

Net Vision intentionally separates different kinds of truth:

| Question | Public source of truth |
| --- | --- |
| Does a Button Presser exist? | Persisted token registry derived from authoritative collection records and chain checks |
| What official traits does it have? | Collection metadata, including the `Plate` trait |
| What number or pattern categories does it belong to? | Versioned Net Vision taxonomy |
| What curated category does it belong to? | Versioned curated lists in the taxonomy |
| Is it listed, unlisted, stale, sold, or offered? | Net Vision market index built from marketplace events and verification reads |
| What can the wallet be asked to execute? | Chain configuration and transaction-policy allowlists |

These sources must not be collapsed into one shortcut. For example, `3 Digit` is a Net Vision interpretation of a Button number, while `Brass` is an official metadata fact. Even when two groups overlap heavily, they are not the same category.

## Public versus internal documentation

Public docs may explain architecture when it helps users understand trust, freshness, or safety. They should not expose secrets, credentials, internal operator controls, private administrative procedures, or implementation details that create security risk without user benefit.

Internal files under `docs/agent`, `docs/adr`, QA documents, deployment runbooks, and low-level indexer specifications remain engineering references. Public pages should link concepts back to code or protocol facts where useful, but should be written for product users first.

## Editorial rule

If the product, code, and docs disagree, fix the docs or the product before calling the behavior supported. A public page should never resolve ambiguity by making a stronger claim than the implementation can prove.
