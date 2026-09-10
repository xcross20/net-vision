/**
 * A4 SQL for collection/category reads.
 * Supply is collections.official_supply. Discovery-envelope ids never
 * enter listed/floor aggregates.
 */
import { CANONICAL_EXISTING_TOKEN_SQL } from './canonical-universe';

/** Collection listed/floor/bootstrap. Alias `c` = collections, `m` = token_market_state. */
export const SQL_COLLECTION_MARKET_FACTS = `
SELECT
  c.id AS collection_id,
  c.official_supply AS official_supply,
  COUNT(*) FILTER (WHERE m.listing_state = 'LISTED') AS listed_count,
  COUNT(*) FILTER (WHERE m.listing_state = 'STALE') AS stale_listed_count,
  COUNT(*) FILTER (
    WHERE m.listing_state IN ('LISTED', 'UNLISTED_VERIFIED', 'STALE')
  ) AS established_count,
  COUNT(*) FILTER (WHERE m.listing_state = 'UNKNOWN' OR m.listing_state IS NULL) AS unknown_count,
  MIN(m.best_price_decimal) FILTER (WHERE m.listing_state = 'LISTED') AS floor_price,
  MIN(m.best_price_decimal) FILTER (
    WHERE m.listing_state = 'STALE' AND m.best_price_decimal IS NOT NULL
  ) AS last_known_floor
FROM collections c
LEFT JOIN token_market_state m
  ON m.collection_id = c.id
 AND m.token_id >= 1
 AND m.token_id <= c.official_supply
WHERE c.id = $1
GROUP BY c.id, c.official_supply
`;

/** Category membership from token_facets, market from token_market_state. */
export const SQL_CATEGORY_MARKET_FACTS = `
SELECT
  f.slug AS slug,
  COUNT(*) AS member_count,
  COUNT(*) FILTER (WHERE m.listing_state = 'LISTED') AS listed_count,
  COUNT(*) FILTER (WHERE m.listing_state = 'STALE') AS stale_listed_count,
  COUNT(*) FILTER (
    WHERE m.listing_state IN ('LISTED', 'UNLISTED_VERIFIED', 'STALE')
  ) AS established_count,
  COUNT(*) FILTER (WHERE m.listing_state IS NULL OR m.listing_state = 'UNKNOWN') AS unknown_count,
  MIN(m.best_price_decimal) FILTER (WHERE m.listing_state = 'LISTED') AS floor_price,
  MIN(m.best_price_decimal) FILTER (
    WHERE m.listing_state = 'STALE' AND m.best_price_decimal IS NOT NULL
  ) AS last_known_floor,
  MAX(m.best_price_decimal) FILTER (WHERE m.listing_state = 'LISTED') AS ceiling_price,
  COUNT(DISTINCT m.seller) FILTER (WHERE m.listing_state = 'LISTED' AND m.seller IS NOT NULL) AS owners
FROM collections c
JOIN token_facets f
  ON f.collection_id = c.id
JOIN tokens t
  ON t.collection_id = f.collection_id
 AND t.token_id = f.token_id
LEFT JOIN token_market_state m
  ON m.collection_id = f.collection_id
 AND m.token_id = f.token_id
WHERE c.id = $1
  AND f.slug = $2
  AND ${CANONICAL_EXISTING_TOKEN_SQL}
GROUP BY f.slug
`;

export const SQL_CATEGORY_LISTED_TOKENS = `
SELECT
  t.token_id,
  t.name,
  t.image_url,
  t.owner_address,
  m.best_price_decimal,
  m.currency,
  m.best_order_hash,
  m.listed_at,
  m.listing_state
FROM collections c
JOIN token_facets f
  ON f.collection_id = c.id
JOIN tokens t
  ON t.collection_id = f.collection_id
 AND t.token_id = f.token_id
JOIN token_market_state m
  ON m.collection_id = f.collection_id
 AND m.token_id = f.token_id
WHERE c.id = $1
  AND f.slug = $2
  AND m.listing_state = 'LISTED'
  AND ${CANONICAL_EXISTING_TOKEN_SQL}
ORDER BY m.best_price_decimal ASC NULLS LAST, t.token_id ASC
LIMIT $3 OFFSET $4
`;

/** Collection-wide cheapest LISTED asks. No category join. */
export const SQL_COLLECTION_LISTED_TOKENS = `
SELECT
  t.token_id,
  t.name,
  t.image_url,
  t.owner_address,
  m.best_price_decimal,
  m.currency,
  m.best_order_hash,
  m.listed_at,
  m.listing_state
FROM collections c
JOIN token_market_state m
  ON m.collection_id = c.id
JOIN tokens t
  ON t.collection_id = m.collection_id
 AND t.token_id = m.token_id
WHERE c.id = $1
  AND m.listing_state = 'LISTED'
  AND ${CANONICAL_EXISTING_TOKEN_SQL}
ORDER BY m.best_price_decimal ASC NULLS LAST, t.token_id ASC
LIMIT $2 OFFSET $3
`;

export const SQL_ACCOUNT_TOKENS = `
SELECT
  t.token_id,
  t.name,
  t.image_url,
  t.owner_address,
  m.best_price_decimal,
  m.currency,
  m.best_order_hash,
  m.listed_at,
  m.listing_state
FROM collections c
JOIN tokens t
  ON t.collection_id = c.id
LEFT JOIN token_market_state m
  ON m.collection_id = t.collection_id
 AND m.token_id = t.token_id
WHERE c.id = $1
  AND lower(t.owner_address) = lower($2)
  AND ${CANONICAL_EXISTING_TOKEN_SQL}
ORDER BY t.token_id ASC
LIMIT 500
`;

export const SQL_OWNER_ADDRESS_COUNT = `
SELECT COUNT(*)::int AS n
FROM collections c
JOIN tokens t ON t.collection_id = c.id
WHERE c.id = $1
  AND t.owner_address IS NOT NULL
  AND ${CANONICAL_EXISTING_TOKEN_SQL}
`;

export const SQL_MARKET_EVENT_HIGH_WATER = `
SELECT COALESCE(MAX(id), 0)::bigint AS high_water
FROM market_events
WHERE collection_id = $1
`;

export const SQL_RECENT_SALES = `
SELECT
  s.token_id, s.price, s.currency, s.occurred_at, s.order_hash, s.buyer, s.seller
FROM collections c
JOIN sales s ON s.collection_id = c.id
WHERE c.id = $1
  AND s.token_id >= 1 AND s.token_id <= c.official_supply
ORDER BY s.occurred_at DESC
LIMIT $2
`;

export const SQL_TOKEN_SALES = `
SELECT
  s.token_id, s.price, s.currency, s.occurred_at, s.order_hash, s.buyer, s.seller
FROM collections c
JOIN sales s ON s.collection_id = c.id
WHERE c.id = $1
  AND s.token_id = $2
  AND s.token_id >= 1 AND s.token_id <= c.official_supply
ORDER BY s.occurred_at DESC
LIMIT $3
`;

export const SQL_CATEGORY_SALES = `
SELECT
  s.token_id, s.price, s.currency, s.occurred_at, s.order_hash, s.buyer, s.seller
FROM collections c
JOIN sale_attributions a ON a.collection_id = c.id
JOIN sales s
  ON s.collection_id = a.collection_id
 AND s.sale_event_id = a.sale_event_id
WHERE c.id = $1
  AND a.category_slug = $2
  AND s.token_id >= 1 AND s.token_id <= c.official_supply
  AND ($3::timestamptz IS NULL OR s.occurred_at >= $3)
ORDER BY s.occurred_at DESC
LIMIT $4
`;
