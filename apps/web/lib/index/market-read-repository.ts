/**
 * A4 SQL read boundary. Separate from MarketRepository (writers).
 */
import type { Pool } from 'pg';
import type { TokenFacet } from '@net-vision/taxonomy';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import type { ListingState } from '../market/listing-state';
import { BUTTON_PRESSER_COLLECTION_ID } from './schema-v2';
import {
  SQL_ACCOUNT_TOKENS,
  SQL_ALL_CATEGORY_MARKET_FACTS,
  SQL_ALL_CATEGORY_SALES,
  SQL_CATEGORY_LISTED_TOKENS,
  SQL_CATEGORY_MARKET_FACTS,
  SQL_CATEGORY_SALES,
  SQL_COLLECTION_LISTED_TOKENS,
  SQL_COLLECTION_MARKET_FACTS,
  SQL_MARKET_EVENT_HIGH_WATER,
  SQL_OWNER_ADDRESS_COUNT,
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
  metadataVerifiedAt: number | null;
  ownerAddress: string | null;
  price: number | null;
  currency: string | null;
  orderHash: string | null;
  listedAt: number | null;
  listingState: ListingState;
};

export type TokenSummaryRow = {
  tokenId: number;
  name: string | null;
  imageUrl: string | null;
  metadataVerifiedAt: number | null;
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

export class OwnerIndexIncompleteError extends Error {
  readonly code = 'OWNER_INDEX_INCOMPLETE' as const;
  constructor() {
    super('token owner_address coverage is empty; inventory is unavailable, not zero');
  }
}

export function emptyCategoryFacts(slug: string): CategoryMarketFacts {
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

export interface MarketReadRepository {
  collectionFacts(collectionId: string): Promise<CollectionMarketFacts>;
  categoryFacts(collectionId: string, slug: string): Promise<CategoryMarketFacts | null>;
  allCategoryFacts(collectionId: string): Promise<CategoryMarketFacts[]>;
  listListedTokens(
    collectionId: string,
    slug: string | null,
    limit: number,
    offset: number,
  ): Promise<ListedTokenRow[]>;
  listAccountTokens(collectionId: string, ownerAddress: string): Promise<ListedTokenRow[]>;
  snapshotRevision(collectionId: string): Promise<number>;
  getMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null>;
  getTokenSummary(collectionId: string, tokenId: number): Promise<TokenSummaryRow | null>;
  listRecentSales(collectionId: string, limit: number): Promise<SaleReadRow[]>;
  listTokenSales(collectionId: string, tokenId: number, limit: number): Promise<SaleReadRow[]>;
  listCategorySales(
    collectionId: string,
    slug: string,
    limit: number,
    sinceMs: number | null,
  ): Promise<SaleReadRow[]>;
  listAllCategorySales(collectionId: string): Promise<Array<SaleReadRow & { slug: string }>>;
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

  async allCategoryFacts(collectionId: string): Promise<CategoryMarketFacts[]> {
    const slugs = new Set<string>();
    for (const row of this.mem.facetRows(collectionId)) {
      for (const facet of row.facets) slugs.add(facet.slug);
    }
    const out: CategoryMarketFacts[] = [];
    for (const slug of slugs) {
      const facts = await this.categoryFacts(collectionId, slug);
      if (facts) out.push(facts);
    }
    return out;
  }

  async categoryFacts(collectionId: string, slug: string): Promise<CategoryMarketFacts | null> {
    const members = this.members(collectionId, slug);
    if (members.length === 0) {
      return emptyCategoryFacts(slug);
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
    slug: string | null,
    limit: number,
    offset: number,
  ): Promise<ListedTokenRow[]> {
    const members = slug ? new Set(this.members(collectionId, slug)) : null;
    const tokens = new Map(this.mem.tokenRows(collectionId).map((row) => [row.tokenId, row]));
    const listed = this.mem
      .marketRows(collectionId)
      .filter(
        (row) =>
          row.listingState === 'LISTED' &&
          isOfficialExistingTokenId(row.tokenId) &&
          (members == null || members.has(row.tokenId)),
      )
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.tokenId - b.tokenId)
      .slice(offset, offset + limit);
    return listed.map((row) => {
      const token = tokens.get(row.tokenId);
      return {
        tokenId: row.tokenId,
        name: token?.name ?? null,
        imageUrl: token?.imageUrl ?? null,
        metadataVerifiedAt: token?.metadataVerifiedAt ?? null,
        ownerAddress: token?.ownerAddress ?? row.seller,
        price: row.price,
        currency: row.currency,
        orderHash: row.orderHash,
        listedAt: row.listedAt,
        listingState: row.listingState,
      };
    });
  }

  async listAccountTokens(collectionId: string, ownerAddress: string): Promise<ListedTokenRow[]> {
    const needle = ownerAddress.toLowerCase();
    const owned = this.mem
      .tokenRows(collectionId)
      .filter((row) => isOfficialExistingTokenId(row.tokenId) && row.ownerAddress?.toLowerCase() === needle);
    const withOwner = this.mem
      .tokenRows(collectionId)
      .filter((row) => isOfficialExistingTokenId(row.tokenId) && row.ownerAddress);
    if (withOwner.length === 0) throw new OwnerIndexIncompleteError();
    const market = new Map(this.mem.marketRows(collectionId).map((row) => [row.tokenId, row]));
    return owned.map((token) => {
      const row = market.get(token.tokenId);
      return {
        tokenId: token.tokenId,
        name: token.name ?? null,
        imageUrl: token.imageUrl ?? null,
        metadataVerifiedAt: token.metadataVerifiedAt ?? null,
        ownerAddress: token.ownerAddress,
        price: row?.listingState === 'LISTED' ? row.price : null,
        currency: row?.currency ?? null,
        orderHash: row?.listingState === 'LISTED' ? row.orderHash : null,
        listedAt: row?.listedAt ?? null,
        listingState: row?.listingState ?? 'UNKNOWN',
      };
    });
  }

  async snapshotRevision(collectionId: string): Promise<number> {
    const sales = this.mem.saleRows(collectionId).length;
    const market = this.mem.marketRows(collectionId).length;
    return sales + market;
  }

  async getMarketState(collectionId: string, tokenId: number): Promise<SqlTokenMarketState | null> {
    if (!isOfficialExistingTokenId(tokenId)) return null;
    return this.mem.getTokenMarketState(collectionId, tokenId);
  }

  async getTokenSummary(
    collectionId: string,
    tokenId: number,
  ): Promise<TokenSummaryRow | null> {
    if (!isOfficialExistingTokenId(tokenId)) return null;
    const token = this.mem.token(collectionId, tokenId);
    if (!token) return null;
    return {
      tokenId,
      name: token.name ?? null,
      imageUrl: token.imageUrl ?? null,
      metadataVerifiedAt: token.metadataVerifiedAt ?? null,
    };
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

  async listAllCategorySales(collectionId: string): Promise<Array<SaleReadRow & { slug: string }>> {
    const attributions = this.mem.attributionRows(collectionId);
    const sales = new Map(
      this.mem
        .saleRows(collectionId)
        .filter((row) => isOfficialExistingTokenId(row.tokenId))
        .map((row) => [row.saleEventId, row]),
    );
    const out: Array<SaleReadRow & { slug: string }> = [];
    for (const attr of attributions) {
      const sale = sales.get(attr.saleEventId);
      if (!sale) continue;
      out.push({ ...saleReadRow(sale), slug: attr.categorySlug });
    }
    return out.sort((a, b) => b.occurredAt - a.occurredAt);
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

  async allCategoryFacts(collectionId: string): Promise<CategoryMarketFacts[]> {
    const result = await this.pool.query(SQL_ALL_CATEGORY_MARKET_FACTS, [collectionId]);
    return result.rows.map((row) => pgCategoryFacts(row));
  }

  async categoryFacts(collectionId: string, slug: string): Promise<CategoryMarketFacts | null> {
    const result = await this.pool.query(SQL_CATEGORY_MARKET_FACTS, [collectionId, slug]);
    const row = result.rows[0];
    if (!row) return emptyCategoryFacts(slug);
    return pgCategoryFacts(row);
  }

  async listListedTokens(
    collectionId: string,
    slug: string | null,
    limit: number,
    offset: number,
  ): Promise<ListedTokenRow[]> {
    const result = slug
      ? await this.pool.query(SQL_CATEGORY_LISTED_TOKENS, [collectionId, slug, limit, offset])
      : await this.pool.query(SQL_COLLECTION_LISTED_TOKENS, [collectionId, limit, offset]);
    return result.rows.map(pgListedRow);
  }

  async listAccountTokens(collectionId: string, ownerAddress: string): Promise<ListedTokenRow[]> {
    const coverage = await this.pool.query(SQL_OWNER_ADDRESS_COUNT, [collectionId]);
    const n = Number(coverage.rows[0]?.n ?? 0);
    if (n === 0) throw new OwnerIndexIncompleteError();
    const result = await this.pool.query(SQL_ACCOUNT_TOKENS, [collectionId, ownerAddress]);
    return result.rows.map(pgListedRow);
  }

  async snapshotRevision(collectionId: string): Promise<number> {
    const result = await this.pool.query(SQL_MARKET_EVENT_HIGH_WATER, [collectionId]);
    return Number(result.rows[0]?.high_water ?? 0);
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

  async getTokenSummary(
    collectionId: string,
    tokenId: number,
  ): Promise<TokenSummaryRow | null> {
    if (!isOfficialExistingTokenId(tokenId)) return null;
    const result = await this.pool.query(
      `SELECT token_id, name, image_url, metadata_verified_at
         FROM tokens
        WHERE collection_id = $1 AND token_id = $2`,
      [collectionId, tokenId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      tokenId: Number(row.token_id),
      name: row.name ?? null,
      imageUrl: row.image_url ?? null,
      metadataVerifiedAt: row.metadata_verified_at
        ? new Date(row.metadata_verified_at).getTime()
        : null,
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

  async listAllCategorySales(collectionId: string): Promise<Array<SaleReadRow & { slug: string }>> {
    const result = await this.pool.query(SQL_ALL_CATEGORY_SALES, [collectionId]);
    return result.rows.map((row) => ({ ...pgSaleRow(row), slug: String(row.slug) }));
  }

  async workerHealth(): Promise<ReadWorkerHealth> {
    const result = await this.pool.query<{ payload: Record<string, unknown> | null }>(
      `SELECT payload FROM index_blob WHERE id = $1`,
      ['market-index'],
    );
    const payload = result.rows[0]?.payload;
    if (!payload || typeof payload !== 'object') {
      return { workerOnline: false, streamConnected: false, heartbeatAgeMs: null };
    }
    const worker = (payload.worker ?? {}) as { workerHeartbeatAt?: number };
    const maintenance = (payload.maintenance ?? {}) as { streamConnected?: boolean };
    const hb = Number(worker.workerHeartbeatAt);
    const heartbeatAgeMs = Number.isFinite(hb) ? Date.now() - hb : null;
    return {
      workerOnline: heartbeatAgeMs != null && heartbeatAgeMs <= 60_000,
      streamConnected: Boolean(maintenance.streamConnected),
      heartbeatAgeMs,
    };
  }
}

function pgCategoryFacts(row: {
  slug: string;
  member_count: unknown;
  listed_count: unknown;
  stale_listed_count: unknown;
  established_count: unknown;
  unknown_count: unknown;
  floor_price: unknown;
  last_known_floor: unknown;
  ceiling_price: unknown;
  owners: unknown;
}): CategoryMarketFacts {
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

function pgListedRow(row: {
  token_id: unknown;
  name: string | null;
  image_url: string | null;
  metadata_verified_at?: Date | string | null;
  owner_address: string | null;
  best_price_decimal: unknown;
  currency: string | null;
  best_order_hash: string | null;
  listed_at: Date | string | null;
  listing_state: ListingState;
}): ListedTokenRow {
  return {
    tokenId: Number(row.token_id),
    name: row.name ?? null,
    imageUrl: row.image_url ?? null,
    metadataVerifiedAt: row.metadata_verified_at
      ? new Date(row.metadata_verified_at).getTime()
      : null,
    ownerAddress: row.owner_address ?? null,
    price: num(row.best_price_decimal),
    currency: row.currency ?? null,
    orderHash: row.best_order_hash ?? null,
    listedAt: row.listed_at ? new Date(row.listed_at).getTime() : null,
    listingState: row.listing_state,
  };
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
