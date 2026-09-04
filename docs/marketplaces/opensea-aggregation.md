# OpenSea Aggregation

Net Vision aggregates OpenSea listings and offers into the unified `/market` surface. The aggregation layer is read-only.

## Read path

1. The OpenSea gateway (`@net-vision/opensea-client`) calls OpenSea v2 endpoints with the server-side API key.
2. Responses are validated against Zod schemas. Unknown fields are tolerated; missing required fields fail closed.
3. The indexer persists orders into the `market_orders` table with `marketplace='opensea'`.
4. The web app reads from the local table, never from OpenSea directly.

## Cadence

- Best listings hot sync: 15 to 30 seconds for viewed and active tokens.
- Collection listing crawl: 1 to 3 minutes subject to API limits.
- Events sync: 30 to 60 seconds.
- Owner reconciliation: 5 to 15 minutes, plus immediate post-trade refresh.

Cadences are goals, not promises. The UI shows a data freshness badge when listing or event data is older than the SLA.

## Resilient ingestion

- Idempotent reads are retried on transient `429`/`5xx` with jittered exponential backoff.
- Write and fulfillment-prep calls are not retried; semantic ambiguity fails closed.
- Cursors persist only after successful page processing.

## Unified listing row

A listing row carries:

- Token number (canonical)
- Price and currency
- Expiry
- Maker (truncated)
- Marketplace source badge (Net Vision vs OpenSea)
- Data freshness timestamp

The unified row is produced by a server-side merge that joins the local `market_orders` rows for both marketplaces.

## What is NOT aggregated

- OpenSea private listings (where the maker restricts takers) are excluded.
- Expired orders are excluded.
- Orders whose target is not in the allowlist are excluded.
