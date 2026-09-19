/**
 * Durable purchase intents, OpenSea UX leases, native FILL_PENDING columns.
 * Additive. Does not drop native_listings or cart client state.
 */
export const SCHEMA_PURCHASE_INTENT_SQL = `
INSERT INTO schema_migrations (id) VALUES ('purchase-intent-v1')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS purchase_intents (
  id TEXT PRIMARY KEY,
  buyer TEXT NOT NULL,
  order_hash TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  cart_revision INTEGER NOT NULL,
  state TEXT NOT NULL,
  tx_hash TEXT,
  receipt_status TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_intents_state_chk CHECK (
    state IN ('PREPARING','PREPARED','SUBMITTED','CONFIRMED','FAILED','SOLD','EXPIRED')
  ),
  CONSTRAINT purchase_intents_source_chk CHECK (source IN ('opensea','native'))
);
CREATE INDEX IF NOT EXISTS purchase_intents_order_idx
  ON purchase_intents (order_hash, state);
CREATE INDEX IF NOT EXISTS purchase_intents_buyer_idx
  ON purchase_intents (buyer, created_at);

CREATE TABLE IF NOT EXISTS listing_leases (
  order_hash TEXT PRIMARY KEY,
  buyer TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE native_listings ADD COLUMN IF NOT EXISTS execution_state TEXT NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE native_listings ADD COLUMN IF NOT EXISTS execution_buyer TEXT;
ALTER TABLE native_listings ADD COLUMN IF NOT EXISTS execution_expires_at TIMESTAMPTZ;
ALTER TABLE native_listings ADD COLUMN IF NOT EXISTS execution_intent_id TEXT;
`;
