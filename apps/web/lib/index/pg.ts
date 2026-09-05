/**
 * Postgres persistence for the market index.
 *
 * Dual-write companion to the JSON snapshot: the in-memory IndexSnapshot
 * remains the request-path source of truth. When DATABASE_URL is set we
 * also persist the full blob + normalized tables so redeploys and
 * multi-replica boots can recover without OpenSea re-sync.
 */
import { Pool, type PoolClient } from 'pg';
import type { IndexSnapshot, TokenRow, WorkerCheckpoint } from './store';
import type { ListingRecord } from '../market/listing-state';
import type { CatalogSale } from '../market/catalog';
import type { FloorSnapshot, SaleAttribution } from '../market/engine';
import type { TokenFacet } from '@net-vision/taxonomy';

const BLOB_ID = 'market-index';
const WORKER_ID = 'web-indexer';

/** Inlined so Next/Nixpacks never lose schema.sql at runtime. */
const SCHEMA_SQL = `
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
  "exists" BOOLEAN NOT NULL DEFAULT TRUE,
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
CREATE INDEX IF NOT EXISTS idx_token_market_state_listing ON token_market_state (listing_state);
CREATE INDEX IF NOT EXISTS idx_token_categories_slug ON token_categories (category_slug);
CREATE INDEX IF NOT EXISTS idx_sales_occurred ON sales (occurred_at DESC);
`;

let pool: Pool | null = null;
let schemaReady = false;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function getPool(): Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : undefined,
    });
  }
  return pool;
}

export async function ensureSchema(): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  if (schemaReady) return true;
  await db.query(SCHEMA_SQL);
  schemaReady = true;
  return true;
}

function msToDate(ms: number | null | undefined): Date | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms);
}

export async function loadSnapshotFromPg(): Promise<IndexSnapshot | null> {
  const db = getPool();
  if (!db) return null;
  await ensureSchema();
  const result = await db.query<{ payload: IndexSnapshot }>(
    `SELECT payload FROM index_blob WHERE id = $1`,
    [BLOB_ID],
  );
  const row = result.rows[0];
  if (!row?.payload || typeof row.payload !== 'object') return null;
  return row.payload;
}

async function upsertNormalized(client: PoolClient, snap: IndexSnapshot): Promise<void> {
  const taxonomyVersion = snap.taxonomyVersion || 'unknown';

  for (const token of Object.values(snap.tokens)) {
    await client.query(
      `INSERT INTO tokens (
         token_id, display_number, "exists", owner_address, name, image_url,
         metadata_json, metadata_verified_at, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (token_id) DO UPDATE SET
         display_number = EXCLUDED.display_number,
         "exists" = EXCLUDED."exists",
         owner_address = COALESCE(EXCLUDED.owner_address, tokens.owner_address),
         name = COALESCE(EXCLUDED.name, tokens.name),
         image_url = COALESCE(EXCLUDED.image_url, tokens.image_url),
         metadata_json = COALESCE(EXCLUDED.metadata_json, tokens.metadata_json),
         metadata_verified_at = COALESCE(EXCLUDED.metadata_verified_at, tokens.metadata_verified_at),
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        Number(token.tokenId),
        token.displayNumber,
        token.exists,
        token.ownerAddress,
        token.name,
        token.imageUrl,
        token.metadataJson,
        msToDate(token.metadataVerifiedAt),
        msToDate(token.lastSeenAt) ?? new Date(),
      ],
    );
  }

  await client.query(`DELETE FROM token_categories`);
  for (const [slug, members] of Object.entries(snap.categories ?? {})) {
    for (const tokenId of members) {
      await client.query(
        `INSERT INTO token_categories (token_id, category_slug, taxonomy_version)
         VALUES ($1,$2,$3)
         ON CONFLICT (token_id, category_slug) DO UPDATE SET taxonomy_version = EXCLUDED.taxonomy_version`,
        [Number(tokenId), slug, taxonomyVersion],
      );
    }
  }

  await client.query(`DELETE FROM token_facets`);
  for (const [tokenId, facets] of Object.entries(snap.tokenFacets ?? {})) {
    for (const facet of facets as TokenFacet[]) {
      await client.query(
        `INSERT INTO token_facets (token_id, family, slug, label, source, source_version, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (token_id, family, slug) DO UPDATE SET
           label = EXCLUDED.label,
           source = EXCLUDED.source,
           source_version = EXCLUDED.source_version,
           metadata = EXCLUDED.metadata`,
        [
          Number(tokenId),
          facet.family,
          facet.slug,
          facet.label,
          facet.source,
          facet.sourceVersion ?? null,
          facet.metadata ? JSON.stringify(facet.metadata) : null,
        ],
      );
    }
  }

  for (const listing of Object.values(snap.listings ?? {}) as ListingRecord[]) {
    await client.query(
      `INSERT INTO token_market_state (
         token_id, listing_state, best_order_hash, best_price_decimal, currency,
         seller, listed_at, last_verified_at, consecutive_404s
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (token_id) DO UPDATE SET
         listing_state = EXCLUDED.listing_state,
         best_order_hash = EXCLUDED.best_order_hash,
         best_price_decimal = EXCLUDED.best_price_decimal,
         currency = EXCLUDED.currency,
         seller = EXCLUDED.seller,
         listed_at = EXCLUDED.listed_at,
         last_verified_at = EXCLUDED.last_verified_at,
         consecutive_404s = EXCLUDED.consecutive_404s`,
      [
        Number(listing.tokenId),
        listing.state,
        listing.orderHash,
        listing.price,
        listing.currency,
        listing.seller,
        msToDate(listing.listedAt),
        msToDate(listing.lastVerifiedAt),
        listing.consecutive404s,
      ],
    );
  }

  for (const sale of (snap.sales ?? []) as CatalogSale[]) {
    const saleEventId = `${sale.orderHash ?? ''}:${sale.tokenId}:${sale.occurredAt}:${sale.price}`;
    await client.query(
      `INSERT INTO sales (
         sale_event_id, token_id, price, currency, occurred_at, order_hash, buyer, seller
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (sale_event_id) DO NOTHING`,
      [
        saleEventId,
        Number(sale.tokenId),
        sale.price,
        sale.currency,
        msToDate(sale.occurredAt),
        sale.orderHash,
        sale.buyer,
        sale.seller,
      ],
    );
  }

  for (const row of (snap.saleAttributions ?? []) as SaleAttribution[]) {
    await client.query(
      `INSERT INTO sale_attributions (
         sale_event_id, token_id, category_slug, taxonomy_version,
         facet_source, attributed_price, occurred_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (sale_event_id, category_slug) DO NOTHING`,
      [
        row.saleEventId,
        Number(row.tokenId),
        row.categorySlug,
        row.taxonomyVersion,
        row.facetSource,
        row.attributedPrice,
        msToDate(row.occurredAt),
      ],
    );
  }

  await client.query(`DELETE FROM floor_history`);
  for (const [slug, series] of Object.entries(snap.floorHistory ?? {})) {
    for (const point of series as FloorSnapshot[]) {
      await client.query(
        `INSERT INTO floor_history (category_slug, at, floor, listed)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (category_slug, at) DO UPDATE SET
           floor = EXCLUDED.floor,
           listed = EXCLUDED.listed`,
        [slug, msToDate(point.at), point.floor, point.listed],
      );
    }
  }

  const worker = snap.worker as WorkerCheckpoint;
  await client.query(
    `INSERT INTO worker_state (
       worker_id, last_tick_at, tokens_processed_total, phase, last_error, last_429_at, cursor_state
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (worker_id) DO UPDATE SET
       last_tick_at = EXCLUDED.last_tick_at,
       tokens_processed_total = EXCLUDED.tokens_processed_total,
       phase = EXCLUDED.phase,
       last_error = EXCLUDED.last_error,
       last_429_at = EXCLUDED.last_429_at,
       cursor_state = EXCLUDED.cursor_state`,
    [
      WORKER_ID,
      msToDate(worker.lastTickAt) ?? new Date(),
      worker.processedTotal,
      worker.phase,
      worker.lastError,
      msToDate(worker.last429At),
      JSON.stringify({ cursor: worker.cursor }),
    ],
  );
}

export async function saveSnapshotToPg(
  snap: IndexSnapshot,
  options: { normalized?: boolean; revision?: number } = {},
): Promise<void> {
  const db = getPool();
  if (!db) return;
  await ensureSchema();
  const revision = options.revision ?? snap.snapshotRevision ?? 0;
  // Conditional upsert: never let an older async write clobber a newer one.
  await db.query(
    `INSERT INTO index_blob (id, payload, taxonomy_version, revision, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       taxonomy_version = EXCLUDED.taxonomy_version,
       revision = EXCLUDED.revision,
       updated_at = NOW()
     WHERE index_blob.revision < EXCLUDED.revision`,
    [BLOB_ID, JSON.stringify(snap), snap.taxonomyVersion, revision],
  );
  if (options.normalized === false) return;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await upsertNormalized(client, snap);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(
      '[index/pg] normalized upsert failed',
      err instanceof Error ? err.message : err,
    );
  } finally {
    client.release();
  }
}

/**
 * Fire-and-forget dual-write helper used by saveIndex.
 * Blob-only on the hot path — a full normalized rebuild of 60k rows
 * every SAVE_EVERY tick would stall the worker.
 */
export function scheduleSaveSnapshotToPg(
  snap: IndexSnapshot,
  options: { revision?: number } = {},
): void {
  if (!databaseUrl()) return;
  void saveSnapshotToPg(snap, { normalized: false, revision: options.revision }).catch((err) => {
    console.error('[index/pg] dual-write failed', err instanceof Error ? err.message : err);
  });
}

export type ImportStats = {
  tokens: number;
  listings: number;
  categories: number;
  workerCursor: number;
};

export async function importSnapshot(snap: IndexSnapshot): Promise<ImportStats> {
  await saveSnapshotToPg(snap);
  return {
    tokens: Object.keys(snap.tokens ?? {}).length,
    listings: Object.keys(snap.listings ?? {}).length,
    categories: Object.keys(snap.categories ?? {}).length,
    workerCursor: snap.worker?.cursor ?? 0,
  };
}

/** Exposed for tests / scripts — not part of request path. */
export function _resetPgForTests(): void {
  schemaReady = false;
  if (pool) {
    void pool.end();
    pool = null;
  }
}

export type { TokenRow };
