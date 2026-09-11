# Net Vision Public Docs Implementation

**Status:** Proposed implementation plan. Content drafting has begun under `docs/public/`.

## Objective

Create a first-party Net Vision documentation site comparable in clarity and authority to a protocol documentation portal, but tailored to Net Vision as a marketplace and market-intelligence product.

The docs should answer four questions quickly:

1. What is Net Vision?
2. How are Button Presser categories and market metrics constructed?
3. Where does the data come from and how fresh is it?
4. What exactly happens when a wallet is connected or asked to sign?

The documentation site should become the public product contract for shipped behavior without replacing internal engineering specifications.

## Recommended architecture

### Dedicated docs application

Add a dedicated `apps/docs` application to the existing monorepo rather than embedding documentation pages inside the marketplace application.

Recommended stack:

- Next.js 15, matching `apps/web`;
- MDX content sourced from `docs/public`;
- static generation for normal documentation pages;
- lightweight client-side search index generated at build time;
- shared Net Vision design tokens where practical, without coupling docs availability to marketplace data services;
- independent deployment and custom docs subdomain.

A dedicated app keeps documentation deploys isolated from the trading surface and makes it possible to keep docs available during market-worker or marketplace incidents.

### Content ownership

`docs/public` should remain the canonical source of public prose. `apps/docs` should render it rather than becoming a second copy of the content.

Internal references remain in their current locations:

- `docs/adr` — architectural decisions;
- `docs/agent` — agent operating system and release gates;
- `docs/data` — indexing and data contracts;
- `docs/deploy` — operational deployment notes;
- `docs/security` — detailed engineering invariants;
- `docs/ui` — implementation-facing UI contracts.

Public pages may summarize those documents, but they should not expose internal runbooks by default.

## Proposed public information architecture

### Start Here

- Introduction to Net Vision
- What is Button Presser?
- Quick start: browse a market
- Product status and feature availability

### Markets

- Market overview
- Categories
- Number markets
- Material markets
- Pattern markets
- Culture markets
- Understanding floor, listed count, volume, and coverage
- Live vs Syncing

### Collecting and Trading

- Token pages
- Connecting a wallet
- Portfolio
- Cart and checkout
- Buying a Button
- Offers
- Sweep trading — Gated
- Listing on Net Vision — Gated

### Data

- Data sources
- OpenSea integration
- Marketplace freshness
- Sales attribution
- Historical-data limits
- Category taxonomy and provenance

### Security

- Non-custodial model
- Transaction validation
- Order revalidation and simulation
- Contract and payment allowlists
- Safe wallet practices

### Reference

- Button Presser contract
- Robinhood Chain
- Supported payment assets
- Glossary
- Feature-status matrix
- FAQs
- Release notes

## Homepage design

The docs homepage should not look like an internal wiki. It should establish the product in one screen:

**Net Vision Docs**

> The market intelligence and trading layer for collectible numbers.

Primary paths:

- Understand Net Vision
- Explore Categories
- Learn how market data works
- Learn how trading is secured

A persistent status callout should make it obvious that some commerce capabilities can be gated even while market data is live.

## Navigation and reading model

Desktop:

- left sidebar for section navigation;
- center content column;
- right-side in-page table of contents for long pages;
- persistent search in the header.

Mobile:

- collapsible navigation drawer;
- content-first layout;
- in-page section jump menu;
- no marketplace wallet dependency merely to read docs.

## Documentation components

The MDX layer should support reusable callouts rather than relying on ad-hoc bold text:

```text
<Status state="available|gated|syncing|future" />
<Warning>...</Warning>
<Source type="metadata|derived|curated|marketplace" />
<ContractAddress chain="Robinhood">...</ContractAddress>
<DataFreshness>...</DataFreshness>
```

This makes feature state and source provenance visible and consistent across pages.

## Public source-of-truth hierarchy

The docs renderer should encourage every factual market claim to identify its authority where ambiguity matters:

1. **Chain / collection facts** — configured chain and verified collection facts.
2. **Official NFT traits** — NFT metadata.
3. **Derived category membership** — versioned Net Vision taxonomy.
4. **Curated membership** — versioned curated lists.
5. **Marketplace state** — persisted Net Vision index sourced from OpenSea events and verification reads.
6. **Executable actions** — current chain config plus transaction-policy validation.

This hierarchy prevents public docs from accidentally teaching users incorrect shortcuts such as “all 3 Digit Buttons are Brass” or “not found in the local index means unlisted.”

## Feature-status matrix

The first docs release should include a generated or manually maintained matrix with the following initial state:

| Capability | Documentation state |
| --- | --- |
| Market browsing | Available |
| Category markets | Available |
| Number / Material / Pattern / Culture categories | Available |
| Active listings | Available |
| Sales | Available |
| Offers | Available, read-only |
| Portfolio | Available |
| Cart | Available |
| Buy preparation | Available, execution subject to trading gate |
| Live trade execution | Gated by production configuration and safety release criteria |
| Sweep execution | Gated |
| Offer acceptance | Gated |
| Native listing | Gated |
| Game / rarity / equipment / season / character categories | Future |

The matrix should be reviewed whenever a feature gate changes.

## Versioning and freshness

Each docs build should expose:

- the Git commit used to build the docs;
- a human-readable “last updated” date per page where practical; and
- links to release notes for user-visible behavior changes.

Longer-term, documentation checks should run in CI. Examples:

- fail if a public docs link points to a missing page;
- fail if a public page references a category slug that no longer exists;
- fail if hard-coded contract addresses disagree with `@net-vision/chain-config`;
- flag stale feature-status entries when corresponding feature gates change; and
- lint for prohibited claims such as converting `UNKNOWN` marketplace state into “unlisted.”

Contract addresses and other mechanically available facts should eventually be injected from source code at build time rather than copied manually.

## Search

V1 search can be a static build-time index over page titles, headings, summaries, and glossary entries. It does not need a database or external search service.

Search should prioritize exact product vocabulary such as:

- Brass
- 3 Digit
- palindrome
- floor
- syncing
- OpenSea
- portfolio
- USDG
- wallet
- sweep

## SEO and shareability

Each page should include a stable title, description, canonical URL, Open Graph metadata, and sensible social preview. Public definitions such as “Net Vision categories,” “Button Presser number markets,” and “Net Vision security” should have direct URLs rather than requiring users to navigate from the homepage.

## Deployment

Deploy the docs as an independent service from the market web app and market worker. The exact provider can follow the existing infrastructure, but the key invariant is isolation: a marketplace data incident must not take the documentation site offline.

The intended public URL should be a dedicated documentation subdomain under the Net Vision brand.

## Rollout

### Phase 0 — Content foundation

Current branch:

- establish `docs/public`;
- draft Overview;
- draft Categories;
- draft Market Data and Freshness;
- draft Wallet, Security, and Trading;
- define public/internal content boundaries.

### Phase 1 — Docs shell

- create `apps/docs`;
- render MDX from `docs/public`;
- implement sidebar, page TOC, search, status callouts, code blocks, and mobile navigation;
- add Net Vision visual identity;
- add footer links back to the marketplace and repository.

### Phase 2 — Complete current-product documentation

- Button Presser collection guide;
- market page guide;
- token pages;
- portfolio;
- cart and buy flow;
- activity and offers;
- OpenSea/data-source page;
- glossary;
- FAQ and troubleshooting;
- feature-status page.

### Phase 3 — Documentation integrity automation

- validate internal links;
- source chain configuration into docs builds;
- check category slugs against taxonomy;
- add docs preview builds to pull requests;
- add a release checklist requiring docs review for user-visible behavior changes.

### Phase 4 — Public launch

- bind docs subdomain;
- production analytics limited to privacy-conscious page/search usage;
- submit sitemap;
- link Docs from Net Vision global navigation and footer;
- publish first release notes.

## Acceptance criteria for the first public release

The docs launch is ready when a new user can determine, without reading source code:

- what Net Vision is and why categories exist;
- which classifications are official metadata versus Net Vision interpretations;
- what Live and Syncing mean;
- where listings, sales, and offers come from;
- what historical data Net Vision does and does not claim;
- whether a commerce feature is Available, Gated, or Future;
- why connecting a wallet does not give Net Vision custody;
- what Net Vision validates before an executable wallet action; and
- the current Button Presser contract, chain, and supported settlement asset.

A docs site that looks polished but leaves those questions ambiguous is not complete.
