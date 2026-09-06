/**
 * Schema V2 — collection identity + idempotent market_events.
 *
 * Additive only (ADR 0004 A1). Does not drop index_blob, does not drop
 * token_id primary keys, does not switch the request path.
 *
 * token_id alone is not a market identity. The natural key is
 * (collection_id, token_id). Old PKs stay until A2 writers use the
 * composite ON CONFLICT target.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { LISTING_STATES } from '../market/listing-state';

export const HELIX_ECOSYSTEM_ID = 'helix';
export const BUTTON_PRESSER_COLLECTION_ID = 'button-presser';

/** Semantic ownership of category membership. */
export const FACET_OWNERSHIP = {
  canonical: 'token_facets',
  derived: 'token_categories',
} as const;

export function tokenIdentity(collectionId: string, tokenId: number): string {
  if (!collectionId.trim()) {
    throw new Error('tokenIdentity: collectionId is required');
  }
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    throw new Error(`tokenIdentity: tokenId must be a non-negative integer, got ${tokenId}`);
  }
  return `${collectionId}:${tokenId}`;
}

const LISTING_STATE_SQL = LISTING_STATES.map((s) => `'${s}'`).join(', ');

export const SCHEMA_V2_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecosystems (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  ecosystem_id TEXT NOT NULL REFERENCES ecosystems(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'nft',
  official_supply INTEGER NOT NULL,
  max_token_id INTEGER,
  opensea_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, contract_address),
  UNIQUE (ecosystem_id, slug)
);

INSERT INTO ecosystems (id, slug, name)
VALUES ('${HELIX_ECOSYSTEM_ID}', 'helix', 'Helix')
ON CONFLICT (id) DO NOTHING;

INSERT INTO collections (
  id, ecosystem_id, slug, name, chain_id, contract_address,
  asset_type, official_supply, max_token_id, opensea_slug
) VALUES (
  '${BUTTON_PRESSER_COLLECTION_ID}',
  '${HELIX_ECOSYSTEM_ID}',
  '${BUTTON_PRESSER_COLLECTION.openseaSlug}',
  '${BUTTON_PRESSER_COLLECTION.name}',
  ${ROBINHOOD_CHAIN.id},
  '${BUTTON_PRESSER_COLLECTION.contractAddress}',
  'nft',
  ${BUTTON_PRESSER_COLLECTION.officialExistingSupply},
  ${BUTTON_PRESSER_COLLECTION.maxTokenId},
  '${BUTTON_PRESSER_COLLECTION.openseaSlug}'
)
ON CONFLICT (id) DO UPDATE SET
  official_supply = EXCLUDED.official_supply,
  max_token_id = EXCLUDED.max_token_id,
  contract_address = EXCLUDED.contract_address,
  chain_id = EXCLUDED.chain_id,
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  opensea_slug = EXCLUDED.opensea_slug;

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';
ALTER TABLE token_facets ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';
ALTER TABLE token_categories ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';
ALTER TABLE token_market_state ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';
ALTER TABLE sale_attributions ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';
ALTER TABLE floor_history ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}';

CREATE UNIQUE INDEX IF NOT EXISTS tokens_collection_token_uidx
  ON tokens (collection_id, token_id);
CREATE UNIQUE INDEX IF NOT EXISTS token_market_state_collection_token_uidx
  ON token_market_state (collection_id, token_id);
CREATE UNIQUE INDEX IF NOT EXISTS token_facets_collection_family_slug_uidx
  ON token_facets (collection_id, token_id, family, slug);
CREATE UNIQUE INDEX IF NOT EXISTS token_categories_collection_slug_uidx
  ON token_categories (collection_id, token_id, category_slug);
CREATE INDEX IF NOT EXISTS idx_token_facets_collection_slug
  ON token_facets (collection_id, slug);
CREATE INDEX IF NOT EXISTS idx_token_market_state_listed_price
  ON token_market_state (listing_state, best_price_decimal)
  WHERE listing_state = 'LISTED';

CREATE TABLE IF NOT EXISTS market_events (
  id BIGSERIAL PRIMARY KEY,
  ecosystem_id TEXT NOT NULL REFERENCES ecosystems(id),
  collection_id TEXT NOT NULL REFERENCES collections(id),
  source TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  token_id INTEGER,
  order_hash TEXT,
  transaction_hash TEXT,
  payload_json JSONB,
  occurred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_event_id)
);
CREATE INDEX IF NOT EXISTS idx_market_events_collection_occurred
  ON market_events (collection_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_events_token
  ON market_events (collection_id, token_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_market_state_listing_state_chk'
  ) THEN
    ALTER TABLE token_market_state
      ADD CONSTRAINT token_market_state_listing_state_chk
      CHECK (listing_state IN (${LISTING_STATE_SQL}));
  END IF;
END $$;

COMMENT ON TABLE token_facets IS
  'Canonical membership. Source of truth for category/facet assignment. A4/A5 category queries join this table, not token_categories.';
COMMENT ON TABLE token_categories IS
  'Derived/materialized category-slug lookup. Must be rebuildable from token_facets. Never an independent membership truth.';
COMMENT ON TABLE index_blob IS
  'Checkpoint / disaster-recovery / shadow-comparison snapshot. Not the A4+ request-path authority.';
COMMENT ON TABLE market_events IS
  'Idempotent ingest log. UNIQUE(source, source_event_id). A2 applies state from these rows, not from blob rebuilds.';

INSERT INTO schema_migrations (id) VALUES ('a1-schema-v2')
ON CONFLICT (id) DO NOTHING;
`;
