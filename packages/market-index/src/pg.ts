/**
 * Authoritative Postgres repository for Indexer V3.
 * Hot path uses incremental upserts — never rebuild the full blob per tick.
 */
import { Pool, type PoolClient } from 'pg';
import { MARKET_INDEX_V3_SCHEMA } from './schema';
import type { MarketEvent } from './events';
import type { ListingRecord } from './listing-state';

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
      max: 6,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function ensureSchema(): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  if (schemaReady) return true;
  await db.query(MARKET_INDEX_V3_SCHEMA);
  schemaReady = true;
  return true;
}

function msToDate(ms: number | null | undefined): Date | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms);
}

/** Acquire a session-level advisory lock so only one worker replica runs. */
export async function tryAcquireWorkerLock(lockKey = 42069001): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  await ensureSchema();
  const result = await db.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock($1) AS locked`,
    [lockKey],
  );
  return Boolean(result.rows[0]?.locked);
}

export async function upsertListing(record: ListingRecord): Promise<void> {
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL required');
  await ensureSchema();
  // Ensure token row exists for FK.
  await db.query(
    `INSERT INTO tokens (token_id, display_number, "exists", last_seen_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (token_id) DO UPDATE SET last_seen_at = NOW()`,
    [Number(record.tokenId), record.tokenId],
  );
  await db.query(
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
      Number(record.tokenId),
      record.state,
      record.orderHash,
      record.price,
      record.currency,
      record.seller,
      msToDate(record.listedAt),
      msToDate(record.lastVerifiedAt),
      record.consecutive404s,
    ],
  );
}

export async function readListing(tokenId: string): Promise<ListingRecord | null> {
  const db = getPool();
  if (!db) return null;
  await ensureSchema();
  const result = await db.query<{
    token_id: number;
    listing_state: ListingRecord['state'];
    best_order_hash: string | null;
    best_price_decimal: string | null;
    currency: string | null;
    seller: string | null;
    listed_at: Date | null;
    last_verified_at: Date | null;
    consecutive_404s: number;
  }>(`SELECT * FROM token_market_state WHERE token_id = $1`, [Number(tokenId)]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenId: String(row.token_id),
    state: row.listing_state,
    price: row.best_price_decimal != null ? Number(row.best_price_decimal) : null,
    currency: row.currency,
    orderHash: row.best_order_hash,
    seller: row.seller,
    listedAt: row.listed_at ? row.listed_at.getTime() : null,
    lastVerifiedAt: row.last_verified_at ? row.last_verified_at.getTime() : null,
    consecutive404s: row.consecutive_404s,
  };
}

/**
 * Insert event idempotently. Returns true when this is the first time
 * we have seen the event id (caller should apply state).
 */
export async function insertMarketEvent(event: MarketEvent): Promise<boolean> {
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL required');
  await ensureSchema();
  const result = await db.query(
    `INSERT INTO market_events (
       marketplace_event_id, event_type, token_id, order_hash, price, currency,
       seller, buyer, from_address, to_address, occurred_at, ingested_at, source, raw
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     ON CONFLICT (marketplace_event_id) DO NOTHING
     RETURNING marketplace_event_id`,
    [
      event.marketplaceEventId,
      event.type,
      Number(event.tokenId),
      event.orderHash,
      event.price,
      event.currency,
      event.seller,
      event.buyer,
      event.fromAddress,
      event.toAddress,
      msToDate(event.occurredAt),
      msToDate(event.ingestedAt) ?? new Date(),
      event.source,
      event.raw ? JSON.stringify(event.raw) : null,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function touchWorkerHeartbeat(
  workerId: string,
  patch: {
    phase: string;
    processedTotal?: number;
    lastError?: string | null;
    cursorState?: Record<string, unknown>;
  },
): Promise<void> {
  const db = getPool();
  if (!db) return;
  await ensureSchema();
  await db.query(
    `INSERT INTO worker_state (
       worker_id, last_tick_at, tokens_processed_total, phase, last_error, cursor_state
     ) VALUES ($1, NOW(), $2, $3, $4, $5::jsonb)
     ON CONFLICT (worker_id) DO UPDATE SET
       last_tick_at = NOW(),
       tokens_processed_total = COALESCE(EXCLUDED.tokens_processed_total, worker_state.tokens_processed_total),
       phase = EXCLUDED.phase,
       last_error = EXCLUDED.last_error,
       cursor_state = COALESCE(EXCLUDED.cursor_state, worker_state.cursor_state)`,
    [
      workerId,
      patch.processedTotal ?? 0,
      patch.phase,
      patch.lastError ?? null,
      JSON.stringify(patch.cursorState ?? {}),
    ],
  );
}

export async function upsertStreamCheckpoint(
  streamId: string,
  patch: {
    lastEventAt?: number | null;
    lastConnectedAt?: number | null;
    gapBackfillFrom?: number | null;
    eventsIngestedDelta?: number;
    lastError?: string | null;
  },
): Promise<void> {
  const db = getPool();
  if (!db) return;
  await ensureSchema();
  await db.query(
    `INSERT INTO stream_checkpoints (
       stream_id, last_event_at, last_connected_at, gap_backfill_from, events_ingested, last_error, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (stream_id) DO UPDATE SET
       last_event_at = COALESCE(EXCLUDED.last_event_at, stream_checkpoints.last_event_at),
       last_connected_at = COALESCE(EXCLUDED.last_connected_at, stream_checkpoints.last_connected_at),
       gap_backfill_from = COALESCE(EXCLUDED.gap_backfill_from, stream_checkpoints.gap_backfill_from),
       events_ingested = stream_checkpoints.events_ingested + COALESCE(EXCLUDED.events_ingested, 0),
       last_error = EXCLUDED.last_error,
       updated_at = NOW()`,
    [
      streamId,
      msToDate(patch.lastEventAt ?? null),
      msToDate(patch.lastConnectedAt ?? null),
      msToDate(patch.gapBackfillFrom ?? null),
      patch.eventsIngestedDelta ?? 0,
      patch.lastError ?? null,
    ],
  );
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL required');
  await ensureSchema();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function _resetPoolForTests(): void {
  schemaReady = false;
  if (pool) {
    void pool.end();
    pool = null;
  }
}
