/**
 * Additive schema for collection metadata bootstrap.
 * Does not drop tokens / token_facets / token_market_state.
 */
import { BUTTON_PRESSER_COLLECTION_ID } from './schema-v2';

export const SCHEMA_METADATA_BOOTSTRAP_SQL = `
INSERT INTO schema_migrations (id) VALUES ('metadata-bootstrap-v1')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS token_canonical_metadata (
  collection_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  name TEXT,
  description TEXT,
  image_url TEXT,
  animation_url TEXT,
  metadata_uri TEXT,
  attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  material TEXT,
  button_number INTEGER,
  stamping TEXT,
  metadata_source TEXT NOT NULL,
  metadata_source_uri TEXT,
  metadata_hash TEXT,
  metadata_status TEXT NOT NULL,
  identity_ok BOOLEAN NOT NULL DEFAULT FALSE,
  identity_block_reason TEXT,
  verified_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_version TEXT,
  PRIMARY KEY (collection_id, token_id),
  CONSTRAINT token_canonical_metadata_status_chk CHECK (
    metadata_status IN ('UNKNOWN','FETCHING','VERIFIED','MISSING','INVALID','RETRY','IDENTITY_BLOCK')
  )
);

CREATE INDEX IF NOT EXISTS token_canonical_metadata_status_idx
  ON token_canonical_metadata (collection_id, metadata_status);

CREATE TABLE IF NOT EXISTS token_media (
  collection_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  body BYTEA NOT NULL,
  source_uri_kind TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, token_id)
);

CREATE TABLE IF NOT EXISTS metadata_backfill_checkpoint (
  collection_id TEXT NOT NULL,
  shard INTEGER NOT NULL,
  shard_count INTEGER NOT NULL,
  last_token_id INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  missing INTEGER NOT NULL DEFAULT 0,
  invalid INTEGER NOT NULL DEFAULT 0,
  retry INTEGER NOT NULL DEFAULT 0,
  identity_block INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, shard)
);

CREATE TABLE IF NOT EXISTS metadata_fetch_failures (
  collection_id TEXT NOT NULL,
  token_id INTEGER NOT NULL,
  attempt INTEGER NOT NULL,
  reason TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, token_id, attempt)
);

INSERT INTO metadata_backfill_checkpoint (collection_id, shard, shard_count)
VALUES ('${BUTTON_PRESSER_COLLECTION_ID}', 0, 1)
ON CONFLICT (collection_id, shard) DO NOTHING;
`;
