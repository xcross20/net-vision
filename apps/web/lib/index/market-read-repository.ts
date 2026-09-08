/**
 * A4 SQL read boundary. Separate from MarketRepository (writers).
 */
import type { Pool } from 'pg';
import type { TokenFacet } from '@net-vision/taxonomy';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import type { ListingState } from '../market/listing-state';
import { BUTTON_PRESSER_COLLECTION_ID } from './schema-v2';
import {
  SQL_CATEGORY_LISTED_TOKENS,
  SQL_CATEGORY_MARKET_FACTS,
  SQL_CATEGORY_SALES,
  SQL_COLLECTION_MARKET_FACTS,
  SQL_RECENT_SALES,
  SQL_TOKEN_SALES,
} from './sql-category-queries';
import type { MemoryMarketRepository } from './memory-market-repository';
import type { SqlTokenMarketState } from './market-repository';
import { isOfficialExistingTokenId } from './canonical-universe';

export type CollectionMarketFacts = {
  collectionId: string;
  officialSupply: number;
  listedCount: number;
  staleListedCount: number;
  establishedCount: number;
  unknownCount: number;
  floorPrice: number | null;
  lastKnownFloor: number | null;
};

export type CategoryMarketFacts = {
  slug: string;
  memberCount: number;
  listedCount: number;
  staleListedCount: number;
  establishedCount: number;
  unknownCount: number;
  floorPrice: number | null;
  lastKnownFloor: number | null;
  ceilingPrice: number | null;
  owners: number;
};

export type ListedTokenRow = {
  tokenId: number;
  name: string | null;
  imageUrl: string | null;
  ownerAddress: string | null;
  price: number | null;
  currency: string | null;
  orderHash: string | null;
  listedAt: number | null;
  listingState: ListingState;
};

export type ReadWorkerHealth = {
  workerOnline: boolean;
  streamConnected: boolean;
  heartbeatAgeMs: number | null;
};

export type SaleReadRow = {
  tokenId: number;
  price: number;
  currency: string;
  occurredAt: number;
  orderHash: string | null;
  buyer: string | null;
  seller: string | null;
};

export interface MarketReadRepository {
  collectionFacts(collectionId: string): Promise<CollectionMarketFacts>;
  categoryFacts(collectionId: string, slug: string): Promise<CategoryMarketFacts | null>;
  listListedTokens(
    collectionId: string,
    slug: string,
    limit: number,
    offset: number,
  ): Promise<ListedTokenRow[]>;
  getMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null>;
  listRecentSales(collectionId: string, limit: number): Promise<SaleReadRow[]>;
  listTokenSales(collectionId: string, tokenId: number, limit: number): Promise<SaleReadRow[]>;
  listCategorySales(
    collectionId: string,
    slug: string,
    limit: number,
    sinceMs: number | null,
  ): Promise<SaleReadRow[]>;
  workerHealth(): Promise<ReadWorkerHealth>;
}

function saleReadRow(row: {
  tokenId: number;
  price: number;
  currency: string;
  occurredAt: number;
  orderHash: string | null;
  buyer: string | null;
  seller: string | null;
}): SaleReadRow {
  return {
    tokenId: row.tokenId,
    price: row.price,
    currency: row.currency,
    occurredAt: row.occurredAt,
    orderHash: row.orderHash,
    buyer: row.buyer,
    seller: row.seller,
  };
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyCollectionFacts(collectionId: string): CollectionMarketFacts {
  return {
    collectionId,
    officialSupply: BUTTON_PRESSER_COLLECTION.officialExistingSupply,
    listedCount: 0,
    staleListedCount: 0,
    establishedCount: 0,
    unknownCount: 0,
    floorPrice: null,
    lastKnownFloor: null,
  };
}

export class MemoryMarketReadRepository implements MarketReadRepository {
  private health: ReadWorkerHealth;

  constructor(
    private readonly mem: MemoryMarketRepository,
    health: ReadWorkerHealth = {
      workerOnline: true,
      streamConnected: true,
      heartbeatAgeMs: 1_000,
    },
  ) {
    this.health = { ...health };
  }

  setHealth(health: ReadWorkerHealth): void {
    this.health = { ...health };
  }

  async collectionFacts(collectionId: string): Promise<CollectionMarketFacts> {
    const officialSupply = BUTTON_PRESSER_COLLECTION.officialExistingSupply;
    const rows = this.mem.marketRows(collectionId).filter((row) => isOfficialExistingTokenId(row.tokenId));
    const listed = rows.filter((row) => row.listingState === 'LISTED');
    const stale = rows.filter((row) => row.listingState === 'STALE');
    const established = rows.filter(
      (row) =>
        row.listingState === 'LISTED' ||
        row.listingState === 'UNLISTED_VERIFIED' ||
        row.listingState === 'STALE',
    );
    const listedPrices = listed.map((row) => row.price).filter((p): p is number => p != null);
    const stalePrices = stale.map((row) => row.price).filter((p): p is number => p != null);
    return {
      collectionId,
      officialSupply,
      listedCount: listed.length,
      staleListedCount: stale.length,
      establishedCount: established.length,
      unknownCount: Math.max(officialSupply - established.length, 0),
      floorPrice: listedPrices.length > 0 ? Math.min(...listedPrices) : null,
      lastKnownFloor: stalePrices.length > 0 ? Math.min(...stalePrices) : null,
    };
  }

  async categoryFacts(collectionId: string, slug: string): Promise<CategoryMarketFacts | null> {
    const members = this.members(collectionId, slug);
    if (members.length === 0) {
      return {
        slug,
        memberCount: 0,
        listedCount: 0,
        staleListedCount: 0,
        establishedCount: 0,
        unknownCount: 0,
        floorPrice: null,
        lastKnownFloor: null,
        ceilingPrice: null,
        owners: 0,
      };
    }
    const market = new Map(
      this.mem
        .marketRows(collectionId)
        .filter((row) => isOfficialExistingTokenId(row.tokenId))
        .map((row) => [row.tokenId, row]),
    );
    let listedCount = 0;
    let staleListedCount = 0;
    let establishedCount = 0;
    let unknownCount = 0;
    const listedPrices: number[] = [];
    const stalePrices: number[] = [];
    const owners = new Set<string>();
    for (const tokenId of members) {
      const row = market.get(tokenId);
      const state = row?.listingState;
      if (state === 'LISTED') {
        listedCount += 1;
        establishedCount += 1;
        if (row?.price != null) listedPrices.push(row.price);
        if (row?.seller) owners.add(row.seller.toLowerCase());
      } else if (state === 'STALE') {
        staleListedCount += 1;
        establishedCount += 1;
        if (row?.price != null) stalePrices.push(row.price);
      } else if (state === 'UNLISTED_VERIFIED') {
        establishedCount += 1;
      } else {
        unknownCount += 1;
      }
    }
    return {
      slug,
      memberCount: members.length,
      listedCount,
      staleListedCount,
      establishedCount,
      unknownCount,
      floorPrice: listedPrices.length > 0 ? Math.min(...listedPrices) : null,
      lastKnownFloor: stalePrices.length > 0 ? Math.min(...stalePrices) : null,
      ceilingPrice: listedPrices.length > 0 ? Math.max(...listedPrices) : null,
      owners: owners.size,
    };
  }

  async listListedTokens(
    collectionId: string,
    slug: string,
    limit: number,
    offset: number,
  ): Promise<ListedTokenRow[]> {
    const members = new Set(this.members(collectionId, slug));
    const tokens = new Map(this.mem.tokenRows(collectionId).map((row) => [row.tokenId, row]));
    const listed = this.mem
      .marketRows(collectionId)
      .filter(
        (row) =>
          row.listingState === 'LISTED' &&
          members.has(row.tokenId) &&
          isOfficialExistingTokenId(row.tokenId),
      )
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.tokenId - b.tokenId)
      .slice(offset, offset + limit);
    return listed.map((row) => {
      const token = tokens.get(row.tokenId);
      return {
        tokenId: row.tokenId,
        name: token?.name ?? null,
        imageUrl: token?.imageUrl ?? null,
        ownerAddress: token?.ownerAddress ?? row.seller,
        price: row.price,
        currency: row.currency,
        orderHash: row.orderHash,
        listedAt: row.listedAt,
        listingState: row.listingState,
      };
    });
  }

  async getMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null> {
    if (!isOfficialExistingTokenId(tokenId)) return null;
    return this.mem.getTokenMarketState(collectionId, tokenId);
  }

  async listRecentSales(collectionId: string, limit: number): Promise<SaleReadRow[]> {
    return this.mem
      .saleRows(collectionId)
      .filter((row) => isOfficialExistingTokenId(row.tokenId))
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit)
      .map(saleReadRow);
  }

  async listTokenSales(collectionId: string, tokenId: number, limit: number): Promise<SaleReadRow[]> {
    if (!isOfficialExistingTokenId(tokenId)) return [];
    return this.mem
      .saleRows(collectionId)
      .filter((row) => row.tokenId === tokenId)
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit)
      .map(saleReadRow);
  }

  async listCategorySales(
    collectionId: string,
    slug: string,
    limit: number,
    sinceMs: number | null,
  ): Promise<SaleReadRow[]> {
    const eventIds = new Set(
      this.mem
        .attributionRows(collectionId)
        .filter((row) => row.categorySlug === slug)
        .map((row) => row.saleEventId),
    );
    return this.mem
      .saleRows(collectionId)
      .filter(
        (row) =>
          eventIds.has(row.saleEventId) &&
          isOfficialExistingTokenId(row.tokenId) &&
          (sinceMs == null || row.occurredAt >= sinceMs),
      )
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit)
      .map(saleReadRow);
  }

  async workerHealth(): Promise<ReadWorkerHealth> {
    return { ...this.health };
  }

  private members(collectionId: string, slug: string): number[] {
    const ids = new Set<number>();
    for (const row of this.mem.facetRows(collectionId)) {
      if (!isOfficialExistingTokenId(row.tokenId)) continue;
      if (row.facets.some((facet: TokenFacet) => facet.slug === slug)) ids.add(row.tokenId);
    }
    return [...ids].sort((a, b) => a - b);
  }
}

export class PgMarketReadRepository implements MarketReadRepository {
  constructor(private readonly pool: Pool) {}

  async collectionFacts(collectionId: string): Promise<CollectionMarketFacts> {
    const result = await this.pool.query(SQL_COLLECTION_MARKET_FACTS, [collectionId]);
    const row = result.rows[0];
    if (!row) return emptyCollectionFacts(collectionId);
    return {
      collectionId: row.collection_id,
      officialSupply: Number(row.official_supply),
      listedCount: Number(row.listed_count ?? 0),
      staleListedCount: Number(row.stale_listed_count ?? 0),
      establishedCount: Number(row.established_count ?? 0),
      unknownCount: Number(row.unknown_count ?? 0),
      floorPrice: num(row.floor_price),
      lastKnownFloor: num(row.last_known_floor),
    };
  }

  async categoryFacts(collectionId: string, slug: string): Promise<CategoryMarketFacts | null> {
    const result = await this.pool.query(SQL_CATEGORY_MARKET_FACTS, [collectionId, slug]);
    const row = result.rows[0];
    if (!row) {
      return {
        slug,
        memberCount: 0,
        listedCount: 0,
        staleListedCount: 0,
        establishedCount: 0,
        unknownCount: 0,
        floorPrice: null,
        lastKnownFloor: null,
        ceilingPrice: null,
        owners: 0,
      };
    }
    return {
      slug: row.slug,
      memberCount: Number(row.member_count ?? 0),
      listedCount: Number(row.listed_count ?? 0),
      staleListedCount: Number(row.stale_listed_count ?? 0),
      establishedCount: Number(row.established_count ?? 0),
      unknownCount: Number(row.unknown_count ?? 0),
      floorPrice: num(row.floor_price),
      lastKnownFloor: num(row.last_known_floor),
      ceilingPrice: num(row.ceiling_price),
      owners: Number(row.owners ?? 0),
    };
  }

  async listListedTokens(
    collectionId: string,
    slug: string,
    limit: number,
    offset: number,
  ): Promise<ListedTokenRow[]> {
    const result = await this.pool.query(SQL_CATEGORY_LISTED_TOKENS, [
      collectionId,
      slug,
      limit,
      offset,
    ]);
    return result.rows.map((row) => ({
      tokenId: Number(row.token_id),
      name: row.name ?? null,
      imageUrl: row.image_url ?? null,
      ownerAddress: row.owner_address ?? null,
      price: num(row.best_price_decimal),
      currency: row.currency ?? null,
      orderHash: row.best_order_hash ?? null,
      listedAt: row.listed_at ? new Date(row.listed_at).getTime() : null,
      listingState: row.listing_state,
    }));
  }

  async getMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null> {
    if (!isOfficialExistingTokenId(tokenId)) return null;
    const result = await this.pool.query(
      `SELECT collection_id, token_id, listing_state, best_order_hash, best_price_decimal,
              currency, seller, listed_at, last_verified_at, consecutive_404s,
              state_event_at, state_event_id, state_source
         FROM token_market_state
        WHERE collection_id = $1 AND token_id = $2`,
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
      listedAt: row.listed_at ? new Date(row.listed_at).getTime() : null,
      lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at).getTime() : null,
      consecutive404s: Number(row.consecutive_404s ?? 0),
      stateEventAt: row.state_event_at ? new Date(row.state_event_at).getTime() : null,
      stateEventId: row.state_event_id ?? null,
      stateSource: row.state_source ?? null,
    };
  }

  async listRecentSales(collectionId: string, limit: number): Promise<SaleReadRow[]> {
    const result = await this.pool.query(SQL_RECENT_SALES, [collectionId, limit]);
    return result.rows.map(pgSaleRow);
  }

  async listTokenSales(collectionId: string, tokenId: number, limit: number): Promise<SaleReadRow[]> {
    if (!isOfficialExistingTokenId(tokenId)) return [];
    const result = await this.pool.query(SQL_TOKEN_SALES, [collectionId, tokenId, limit]);
    return result.rows.map(pgSaleRow);
  }

  async listCategorySales(
    collectionId: string,
    slug: string,
    limit: number,
    sinceMs: number | null,
  ): Promise<SaleReadRow[]> {
    const since = sinceMs == null ? null : new Date(sinceMs).toISOString();
    const result = await this.pool.query(SQL_CATEGORY_SALES, [collectionId, slug, since, limit]);
    return result.rows.map(pgSaleRow);
  }

  async workerHealth(): Promise<ReadWorkerHealth> {
    return { workerOnline: true, streamConnected: true, heartbeatAgeMs: 0 };
  }
}

function pgSaleRow(row: {
  token_id: unknown;
  price: unknown;
  currency: string;
  occurred_at: Date | string;
  order_hash: string | null;
  buyer: string | null;
  seller: string | null;
}): SaleReadRow {
  const occurred = row.occurred_at instanceof Date ? row.occurred_at.getTime() : new Date(row.occurred_at).getTime();
  return {
    tokenId: Number(row.token_id),
    price: Number(row.price),
    currency: row.currency,
    occurredAt: occurred,
    orderHash: row.order_hash ?? null,
    buyer: row.buyer ?? null,
    seller: row.seller ?? null,
  };
}

export function defaultCollectionId(): string {
  return BUTTON_PRESSER_COLLECTION_ID;
}
