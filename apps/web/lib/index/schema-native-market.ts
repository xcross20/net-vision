/**
 * Native Net Vision orderbook. Additive. OpenSea listings remain in
 * token_market_state; native rows are a separate authority keyed by
 * order_hash.
 */
export const SCHEMA_NATIVE_MARKET_SQL = `
INSERT INTO schema_migrations (id) VALUES ('native-market-v1')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS native_listings (
  order_hash TEXT PRIMARY KEY,
  ecosystem_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  offerer TEXT NOT NULL,
  price_raw TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDG',
  seaport_version TEXT NOT NULL DEFAULT '1.6',
  protocol_address TEXT NOT NULL,
  conduit_key TEXT NOT NULL,
  zone TEXT NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  salt TEXT NOT NULL,
  signature TEXT,
  parameters_json JSONB NOT NULL,
  marketplace_fee_raw TEXT NOT NULL,
  marketplace_fee_recipient TEXT NOT NULL,
  seller_proceeds_raw TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_native_listings_token
  ON native_listings (collection_id, token_id, status);
CREATE INDEX IF NOT EXISTS idx_native_listings_offerer
  ON native_listings (offerer, status);

CREATE TABLE IF NOT EXISTS native_offer_groups (
  id TEXT PRIMARY KEY,
  buyer_address TEXT NOT NULL,
  ecosystem_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  strategy TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  maximum_liability_raw TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS native_offers (
  id TEXT PRIMARY KEY,
  offer_group_id TEXT REFERENCES native_offer_groups(id) ON DELETE SET NULL,
  ecosystem_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  buyer_address TEXT NOT NULL,
  offer_usdg_raw TEXT NOT NULL,
  seaport_order_hash TEXT NOT NULL UNIQUE,
  seaport_protocol_address TEXT NOT NULL,
  conduit_key TEXT NOT NULL,
  zone TEXT NOT NULL,
  signature TEXT,
  parameters_json JSONB NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_native_offers_group
  ON native_offers (offer_group_id, status);
CREATE INDEX IF NOT EXISTS idx_native_offers_token
  ON native_offers (collection_id, token_id, status);
CREATE INDEX IF NOT EXISTS idx_native_offers_buyer
  ON native_offers (buyer_address, status);

ALTER TABLE native_offer_groups ADD COLUMN IF NOT EXISTS requested_asset_count INTEGER;
ALTER TABLE native_offer_groups ADD COLUMN IF NOT EXISTS starts_at BIGINT;
`;
