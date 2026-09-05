/** V3 authoritative schema. Idempotent — safe on every worker boot. */
export const MARKET_INDEX_V3_SCHEMA = `
CREATE TABLE IF NOT EXISTS index_blob (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  taxonomy_version TEXT,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE index_blob ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tokens (
  token_id INTEGER PRIMARY KEY,
  display_number TEXT NOT NULL,
  "exists" BOOLEAN NOT NULL DEFAULT FALSE,
  owner_address TEXT,
  name TEXT,
  image_url TEXT,
  metadata_json TEXT,
  metadata_verified_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_categories (
  token_id INTEGER NOT NULL REFERENCES tokens(token_id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_id, category_slug)
);

CREATE TABLE IF NOT EXISTS token_facets (
  token_id INTEGER NOT NULL,
  family TEXT NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL,
  source_version TEXT,
  metadata JSONB,
  PRIMARY KEY (token_id, family, slug)
);

CREATE TABLE IF NOT EXISTS token_market_state (
  token_id INTEGER PRIMARY KEY REFERENCES tokens(token_id) ON DELETE CASCADE,
  listing_state TEXT NOT NULL,
  best_order_hash TEXT,
  best_price_decimal NUMERIC,
  currency TEXT,
  seller TEXT,
  listed_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  consecutive_404s INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS market_events (
  marketplace_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  order_hash TEXT,
  price NUMERIC,
  currency TEXT,
  seller TEXT,
  buyer TEXT,
  from_address TEXT,
  to_address TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,
  raw JSONB
);

CREATE TABLE IF NOT EXISTS sales (
  sale_event_id TEXT PRIMARY KEY,
  token_id INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  order_hash TEXT,
  buyer TEXT,
  seller TEXT,
  marketplace TEXT NOT NULL DEFAULT 'opensea',
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_attributions (
  sale_event_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  category_slug TEXT NOT NULL,
  taxonomy_version TEXT NOT NULL,
  facet_source TEXT NOT NULL,
  attributed_price NUMERIC NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (sale_event_id, category_slug)
);

CREATE TABLE IF NOT EXISTS floor_history (
  category_slug TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  floor NUMERIC,
  listed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_slug, at)
);

CREATE TABLE IF NOT EXISTS worker_state (
  worker_id TEXT PRIMARY KEY,
  last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens_processed_total BIGINT NOT NULL DEFAULT 0,
  phase TEXT NOT NULL,
  last_error TEXT,
  last_429_at TIMESTAMPTZ,
  cursor_state JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS stream_checkpoints (
  stream_id TEXT PRIMARY KEY,
  last_event_at TIMESTAMPTZ,
  last_connected_at TIMESTAMPTZ,
  gap_backfill_from TIMESTAMPTZ,
  events_ingested BIGINT NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_market_state_listing ON token_market_state (listing_state);
CREATE INDEX IF NOT EXISTS idx_token_categories_slug ON token_categories (category_slug);
CREATE INDEX IF NOT EXISTS idx_market_events_occurred ON market_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_events_token ON market_events (token_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_occurred ON sales (occurred_at DESC);
`;
