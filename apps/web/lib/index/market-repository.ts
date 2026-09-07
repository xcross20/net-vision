/**
 * Persistence boundary for A2 event-local SQL writes.
 * Worker / ingest code talks to this, not to ad-hoc SQL.
 */
import type { Pool, PoolClient } from 'pg';
import type { TokenFacet } from '@net-vision/taxonomy';
import type { ListingState } from '../market/listing-state';
import type { CanonicalMarketEvent } from './canonical-event';
import { MARKET_EVENT_SOURCE } from './canonical-event';

export type SqlTokenMarketState = {
  collectionId: string;
  tokenId: number;
  listingState: ListingState;
  orderHash: string | null;
  price: number | null;
  currency: string | null;
  seller: string | null;
  listedAt: number | null;
  lastVerifiedAt: number | null;
  consecutive404s: number;
  stateEventAt: number | null;
  stateEventId: string | null;
  stateSource: string | null;
};

export type TokenUpsert = {
  collectionId: string;
  tokenId: number;
  displayNumber: string;
  exists: boolean;
  ownerAddress: string | null;
  name: string | null;
  imageUrl: string | null;
  metadataJson: string | null;
  metadataVerifiedAt: number | null;
  lastSeenAt: number;
};

export type SaleInsert = {
  collectionId: string;
  saleEventId: string;
  tokenId: number;
  price: number;
  currency: string;
  occurredAt: number;
  orderHash: string | null;
  buyer: string | null;
  seller: string | null;
};

export type SaleAttributionInsert = {
  collectionId: string;
  saleEventId: string;
  tokenId: number;
  categorySlug: string;
  taxonomyVersion: string;
  facetSource: string;
  attributedPrice: number;
  occurredAt: number;
};

export type WorkerStateUpsert = {
  workerId: string;
  lastTickAt: number;
  tokensProcessedTotal: number;
  phase: string;
  lastError: string | null;
  last429At: number | null;
  cursorState: unknown;
};

export interface MarketRepository {
  insertMarketEvent(event: CanonicalMarketEvent): Promise<'inserted' | 'duplicate'>;
  getTokenMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null>;
  upsertToken(token: TokenUpsert): Promise<void>;
  replaceTokenFacetsForToken(
    collectionId: string,
    tokenId: number,
    facets: TokenFacet[],
    taxonomyVersion: string,
  ): Promise<void>;
  upsertTokenMarketState(state: SqlTokenMarketState): Promise<void>;
  insertSale(sale: SaleInsert): Promise<void>;
  insertSaleAttributions(rows: SaleAttributionInsert[]): Promise<void>;
  updateWorkerState(row: WorkerStateUpsert): Promise<void>;
  withTransaction<T>(fn: (repo: MarketRepository) => Promise<T>): Promise<T>;
}

type Queryable = {
  query: Pool['query'] | PoolClient['query'];
};

function msToDate(ms: number | null | undefined): Date | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms);
}

function dateToMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export class PgMarketRepository implements MarketRepository {
  constructor(
    private readonly exec: Queryable,
    private readonly inTransaction = false,
  ) {}

  async insertMarketEvent(event: CanonicalMarketEvent): Promise<'inserted' | 'duplicate'> {
    const result = await this.exec.query(
      `INSERT INTO market_events (
         ecosystem_id, collection_id, source, source_event_id, event_type,
         token_id, order_hash, transaction_hash, payload_json, occurred_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       ON CONFLICT (source, source_event_id) DO NOTHING
       RETURNING id`,
      [
        event.ecosystemId,
        event.collectionId,
        MARKET_EVENT_SOURCE,
        event.sourceEventId,
        event.eventType,
        event.tokenId,
        event.orderHash,
        event.transactionHash,
        JSON.stringify({
          transport: event.transport,
          price: event.price,
          currency: event.currency,
          seller: event.seller,
          buyer: event.buyer,
          ownerAddress: event.ownerAddress,
        }),
        msToDate(event.occurredAt),
      ],
    );
    return result.rowCount && result.rowCount > 0 ? 'inserted' : 'duplicate';
  }

  async getTokenMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null> {
    const lock = this.inTransaction ? ' FOR UPDATE' : '';
    const result = await this.exec.query(
      `SELECT collection_id, token_id, listing_state, best_order_hash, best_price_decimal,
              currency, seller, listed_at, last_verified_at, consecutive_404s,
              state_event_at, state_event_id, state_source
         FROM token_market_state
        WHERE collection_id = $1 AND token_id = $2${lock}`,
      [collectionId, tokenId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      collectionId: row.collection_id,
      tokenId: Number(row.token_id),
      listingState: row.listing_state,
      orderHash: row.best_order_hash ?? null,
      price: num(row.best_price_decimal),
      currency: row.currency ?? null,
      seller: row.seller ?? null,
      listedAt: dateToMs(row.listed_at),
      lastVerifiedAt: dateToMs(row.last_verified_at),
      consecutive404s: Number(row.consecutive_404s ?? 0),
      stateEventAt: dateToMs(row.state_event_at),
      stateEventId: row.state_event_id ?? null,
      stateSource: row.state_source ?? null,
    };
  }

  async upsertToken(token: TokenUpsert): Promise<void> {
    await this.exec.query(
      `INSERT INTO tokens (
         collection_id, token_id, display_number, "exists", owner_address, name, image_url,
         metadata_json, metadata_verified_at, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (collection_id, token_id) DO UPDATE SET
         display_number = EXCLUDED.display_number,
         "exists" = EXCLUDED."exists",
         owner_address = COALESCE(EXCLUDED.owner_address, tokens.owner_address),
         name = COALESCE(EXCLUDED.name, tokens.name),
         image_url = COALESCE(EXCLUDED.image_url, tokens.image_url),
         metadata_json = COALESCE(EXCLUDED.metadata_json, tokens.metadata_json),
         metadata_verified_at = COALESCE(EXCLUDED.metadata_verified_at, tokens.metadata_verified_at),
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        token.collectionId,
        token.tokenId,
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

  async replaceTokenFacetsForToken(
    collectionId: string,
    tokenId: number,
    facets: TokenFacet[],
    taxonomyVersion: string,
  ): Promise<void> {
    await this.exec.query(
      `DELETE FROM token_facets WHERE collection_id = $1 AND token_id = $2`,
      [collectionId, tokenId],
    );
    await this.exec.query(
      `DELETE FROM token_categories WHERE collection_id = $1 AND token_id = $2`,
      [collectionId, tokenId],
    );
    for (const facet of facets) {
      await this.exec.query(
        `INSERT INTO token_facets (
           collection_id, token_id, family, slug, label, source, source_version, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (collection_id, token_id, family, slug) DO UPDATE SET
           label = EXCLUDED.label,
           source = EXCLUDED.source,
           source_version = EXCLUDED.source_version,
           metadata = EXCLUDED.metadata`,
        [
          collectionId,
          tokenId,
          facet.family,
          facet.slug,
          facet.label,
          facet.source,
          facet.sourceVersion ?? null,
          facet.metadata ? JSON.stringify(facet.metadata) : null,
        ],
      );
    }
    const slugs = [...new Set(facets.map((f) => f.slug))];
    for (const slug of slugs) {
      await this.exec.query(
        `INSERT INTO token_categories (collection_id, token_id, category_slug, taxonomy_version)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (collection_id, token_id, category_slug) DO UPDATE SET
           taxonomy_version = EXCLUDED.taxonomy_version`,
        [collectionId, tokenId, slug, taxonomyVersion],
      );
    }
  }

  async upsertTokenMarketState(state: SqlTokenMarketState): Promise<void> {
    await this.exec.query(
      `INSERT INTO token_market_state (
         collection_id, token_id, listing_state, best_order_hash, best_price_decimal, currency,
         seller, listed_at, last_verified_at, consecutive_404s,
         state_event_at, state_event_id, state_source, state_updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (collection_id, token_id) DO UPDATE SET
         listing_state = EXCLUDED.listing_state,
         best_order_hash = EXCLUDED.best_order_hash,
         best_price_decimal = EXCLUDED.best_price_decimal,
         currency = EXCLUDED.currency,
         seller = EXCLUDED.seller,
         listed_at = EXCLUDED.listed_at,
         last_verified_at = EXCLUDED.last_verified_at,
         consecutive_404s = EXCLUDED.consecutive_404s,
         state_event_at = EXCLUDED.state_event_at,
         state_event_id = EXCLUDED.state_event_id,
         state_source = EXCLUDED.state_source,
         state_updated_at = NOW()`,
      [
        state.collectionId,
        state.tokenId,
        state.listingState,
        state.orderHash,
        state.price,
        state.currency,
        state.seller,
        msToDate(state.listedAt),
        msToDate(state.lastVerifiedAt),
        state.consecutive404s,
        msToDate(state.stateEventAt),
        state.stateEventId,
        state.stateSource,
      ],
    );
  }

  async insertSale(sale: SaleInsert): Promise<void> {
    await this.exec.query(
      `INSERT INTO sales (
         sale_event_id, collection_id, token_id, price, currency, occurred_at,
         order_hash, buyer, seller
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (sale_event_id) DO NOTHING`,
      [
        sale.saleEventId,
        sale.collectionId,
        sale.tokenId,
        sale.price,
        sale.currency,
        msToDate(sale.occurredAt),
        sale.orderHash,
        sale.buyer,
        sale.seller,
      ],
    );
  }

  async insertSaleAttributions(rows: SaleAttributionInsert[]): Promise<void> {
    for (const row of rows) {
      await this.exec.query(
        `INSERT INTO sale_attributions (
           sale_event_id, collection_id, token_id, category_slug, taxonomy_version,
           facet_source, attributed_price, occurred_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (sale_event_id, category_slug) DO NOTHING`,
        [
          row.saleEventId,
          row.collectionId,
          row.tokenId,
          row.categorySlug,
          row.taxonomyVersion,
          row.facetSource,
          row.attributedPrice,
          msToDate(row.occurredAt),
        ],
      );
    }
  }

  async updateWorkerState(row: WorkerStateUpsert): Promise<void> {
    await this.exec.query(
      `INSERT INTO worker_state (
         worker_id, last_tick_at, tokens_processed_total, phase, last_error, last_429_at, cursor_state
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (worker_id) DO UPDATE SET
         last_tick_at = EXCLUDED.last_tick_at,
         tokens_processed_total = EXCLUDED.tokens_processed_total,
         phase = EXCLUDED.phase,
         last_error = EXCLUDED.last_error,
         last_429_at = EXCLUDED.last_429_at,
         cursor_state = EXCLUDED.cursor_state`,
      [
        row.workerId,
        msToDate(row.lastTickAt) ?? new Date(),
        row.tokensProcessedTotal,
        row.phase,
        row.lastError,
        msToDate(row.last429At),
        JSON.stringify(row.cursorState ?? {}),
      ],
    );
  }

  async withTransaction<T>(fn: (repo: MarketRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(this);
    const pool = this.exec as Pool;
    if (typeof (pool as Pool).connect !== 'function') {
      return fn(this);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = new PgMarketRepository(client, true);
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
