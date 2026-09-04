# Categories UI

The Categories UI is the discovery surface for the algorithmic virtual collections. It is the first thing the user sees in the read-only slice and the primary navigation path.

## Information architecture

- `/categories` is the directory. It lists every virtual collection with member supply, listed percent, and floor.
- `/categories/[slug]` is the detail page. It shows the members, the metrics, and the traits that define the category.
- A category card links to its detail page and is reused on the homepage and in the global nav.

## Category card

Required fields:

- Name (large)
- Slug (mono, muted)
- Family chip (digits, structure, sequence, cultural, math)
- Description (two-line clamp)
- Member supply (mono)
- Listed percent (mono, formatted)
- Floor (mono, primary green)

## Category detail

Above the fold:

- Breadcrumb back to `/categories`
- Family chip and slug
- Name (large)
- Description

Metrics strip:

- Members
- Listed
- Listed percent
- Floor
- Volume (seed)

Member grid: token cards, each linking to `/tokens/[tokenId]`. Empty state if no seeded tokens match.

## Empty state

A category with no members renders a calm panel that says the indexed supply has no matches for that category yet. The category is still listed in the directory because it may gain members as the indexer progresses.

## Trading gate

Until live trading is enabled, the category detail page shows the `TradingGateBanner` above the member grid. Buy / sweep actions remain disabled.

## Accessibility

- Keyboard navigation through every card.
- Visible focus state uses the primary green token.
- Color is never the only signal: every floor and percent value is paired with a mono number.
