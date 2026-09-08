/**
 * A4 SQL MarketSource. Request-path reads from normalized tables.
 * Does not rehydrate TokenCatalog. Worker ingest still uses OpenSeaMarketSource.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { DEFAULT_PAYMENT_CURRENCY, type CategoryMetrics, type CollectionSnapshot, type DataFreshness, type Token } from './types';
import { buildTokenImageUrl } from '../data/media';
import type { MarketSource, ListTokensFilter, ListTokensPage, Offer, Sale, SalesWindow } from './source';
import type { SweepPreview, SweepPreviewInput, FloorSnapshot } from './engine';
import {
  bootstrapCoverage,
  bootstrapMarketStatus,
  categoryFloors,
  realtimeHealth,
} from './sql-readiness';
import { guardCollectionSnapshot } from './impossible-states';
import type { MarketReadRepository } from '../index/market-read-repository';
import { PgMarketReadRepository } from '../index/market-read-repository';
import { BUTTON_PRESSER_COLLECTION_ID } from '../index/schema-v2';
import { getPool } from '../index/pg';

let sqlSingleton: SqlMarketSource | null = null;

export function getSqlMarketSourceOrFail(): SqlMarketSource {
  if (sqlSingleton) return sqlSingleton;
  const pool = getPool();
  if (!pool) {
    throw new Error('MARKET_READ_MODEL=sql requires DATABASE_URL');
  }
  sqlSingleton = new SqlMarketSource(new PgMarketReadRepository(pool));
  return sqlSingleton;
}

function expectedSupply(slug: string, memberCount: number): number {
  const meta = VIRTUAL_COLLECTION_CATALOG.find((entry) => entry.slug === slug);
  if (meta && 'expectedSupply' in meta && typeof meta.expectedSupply === 'number') {
    return meta.expectedSupply;
  }
  return memberCount;
}

export class SqlMarketSource implements MarketSource {
  constructor(
    private readonly reads: MarketReadRepository,
    private readonly collectionId = BUTTON_PRESSER_COLLECTION_ID,
  ) {}

  async getCollectionSnapshot(): Promise<CollectionSnapshot> {
    const facts = await this.reads.collectionFacts(this.collectionId);
    const health = realtimeHealth(await this.reads.workerHealth());
    const coverage = bootstrapCoverage(facts.establishedCount, facts.officialSupply);
    const status = bootstrapMarketStatus(coverage);
    const floors = categoryFloors(
      facts.floorPrice != null ? [facts.floorPrice] : [],
      facts.lastKnownFloor != null ? [facts.lastKnownFloor] : [],
    );
    const snapshot: CollectionSnapshot = {
      name: BUTTON_PRESSER_COLLECTION.name,
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: ROBINHOOD_CHAIN.id,
      openseaChainSlug: '',
      totalSupply: facts.officialSupply,
      owners: null,
      listedCount: facts.listedCount,
      staleListedCount: facts.staleListedCount,
      listingCoverage: coverage,
      marketStatus: status,
      snapshotRevision: facts.establishedCount,
      currency: DEFAULT_PAYMENT_CURRENCY,
      floorPrice: floors.floorPrice,
      volume24hNative: null,
      volume7dNative: null,
      sales24h: null,
      sales7d: null,
      topSalePrice: null,
      topOfferPrice: null,
      refreshedAt: Date.now(),
      realtimeHealth: health,
      bootstrapCoverage: coverage,
    };
    return guardCollectionSnapshot(snapshot);
  }

  async getToken(tokenId: string): Promise<Token | null> {
    const id = Number(tokenId);
    if (!Number.isInteger(id)) return null;
    const state = await this.reads.getMarketState(this.collectionId, id);
    if (!state) return null;
    const listed = state.listingState === 'LISTED';
    return {
      tokenId: String(id),
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: ROBINHOOD_CHAIN.id,
      imageUrl: buildTokenImageUrl(String(id)),
      name: null,
      listingPrice: listed ? state.price : null,
      currency: state.currency ?? DEFAULT_PAYMENT_CURRENCY,
      listingOrderHash: listed ? state.orderHash : null,
      lastSalePrice: null,
      ownerAddress: state.seller,
      traits: [],
      rarityRank: null,
      listedAt: listed && state.listedAt != null ? Math.floor(state.listedAt / 1000) : null,
      lastSaleAt: null,
    };
  }

  async listTokens(filter: ListTokensFilter = {}): Promise<ListTokensPage> {
    const slug = filter.category;
    if (!slug) return { tokens: [], total: 0 };
    const facts = await this.reads.categoryFacts(this.collectionId, slug);
    const limit = Math.min(filter.limit ?? 48, 200);
    const offset = filter.offset ?? 0;
    const listedOnly = filter.listedOnly || filter.status === 'listed';
    if (!listedOnly) {
      const rows = await this.reads.listListedTokens(this.collectionId, slug, limit, offset);
      return { tokens: rows.map((row) => this.toToken(row)), total: facts?.listedCount ?? rows.length };
    }
    const rows = await this.reads.listListedTokens(this.collectionId, slug, limit, offset);
    return { tokens: rows.map((row) => this.toToken(row)), total: facts?.listedCount ?? rows.length };
  }

  async getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
    const meta = VIRTUAL_COLLECTION_CATALOG.find((entry) => entry.slug === slug);
    if (!meta) return null;
    const facts = await this.reads.categoryFacts(this.collectionId, slug);
    if (!facts) return null;
    const snapshot = await this.getCollectionSnapshot();
    const expected = expectedSupply(slug, facts.memberCount);
    const membershipCoverage =
      meta.source === 'metadata' ? bootstrapCoverage(facts.memberCount, expected) : 1;
    const coverage = bootstrapCoverage(facts.establishedCount, expected);
    const status = bootstrapMarketStatus(Math.min(membershipCoverage, coverage));
    const floors = categoryFloors(
      facts.floorPrice != null ? [facts.floorPrice] : [],
      facts.lastKnownFloor != null ? [facts.lastKnownFloor] : [],
    );
    const health = realtimeHealth(await this.reads.workerHealth());
    return {
      slug,
      name: meta.name,
      family: meta.family,
      source: meta.source,
      description: meta.description,
      memberSupply: expected,
      filteredMemberSupply: facts.memberCount || expected,
      totalSupply: snapshot.totalSupply,
      listedCount: facts.listedCount,
      staleListedCount: facts.staleListedCount,
      listedPercentage: expected > 0 ? facts.listedCount / expected : 0,
      verifiedCount: facts.establishedCount,
      unknownCount: facts.unknownCount,
      coveragePercent: Math.min(membershipCoverage, coverage),
      membershipCoverage,
      marketCoverage: coverage,
      marketStatus: status,
      owners: facts.owners,
      currency: snapshot.currency,
      floorPrice: floors.floorPrice,
      lastKnownFloorPrice: floors.lastKnownFloorPrice,
      ceilingPrice: facts.ceilingPrice,
      medianAsk: null,
      lastSalePrice: null,
      topOfferPrice: null,
      offerCount: 0,
      topSalePrice: null,
      highestSale: null,
      volume24h: 0,
      volume7d: 0,
      volume30d: 0,
      volumeAllTracked: 0,
      volume24hNative: 0,
      volume7dNative: 0,
      sales24h: 0,
      sales7d: 0,
      sales30d: 0,
      averageSale: null,
      medianSale: null,
      floorChange24h: null,
      floorChange7d: null,
      floorChange30d: null,
      trendingScore: 0,
      trackedSince: snapshot.refreshedAt,
      bootstrapCoverage: coverage,
      realtimeHealth: health,
    };
  }

  async listCategories(): Promise<CategoryMetrics[]> {
    const rows: CategoryMetrics[] = [];
    for (const entry of VIRTUAL_COLLECTION_CATALOG) {
      const metrics = await this.getCategoryMetrics(entry.slug);
      if (metrics) rows.push(metrics);
    }
    return rows;
  }

  async listRecentSales(_limit = 20): Promise<Sale[]> {
    return [];
  }

  async listTokenSales(_tokenId: string, _limit?: number): Promise<Sale[]> {
    return [];
  }

  async listRecentOffers(_limit?: number): Promise<Offer[]> {
    return [];
  }

  async getTokenOffers(_tokenId: string): Promise<Offer[]> {
    return [];
  }

  async getAccountListings(_address: string): Promise<Token[]> {
    return [];
  }

  async getAccountOffers(_address: string): Promise<Offer[]> {
    return [];
  }

  async listAccountTokens(_address: string): Promise<Token[]> {
    return [];
  }

  async listCategorySales(_slug: string, _options?: { window?: SalesWindow; limit?: number }): Promise<Sale[]> {
    return [];
  }

  async listCategoryTopSales(_slug: string, _limit?: number): Promise<Sale[]> {
    return [];
  }

  async listCategoryOffers(_slug: string, _limit?: number): Promise<Offer[]> {
    return [];
  }

  async previewSweep(_slug: string, _input: SweepPreviewInput): Promise<SweepPreview> {
    return {
      strategy: 'floor',
      items: [],
      count: 0,
      total: 0,
      currency: DEFAULT_PAYMENT_CURRENCY,
      truncated: false,
    };
  }

  async floorHistory(_slug: string): Promise<FloorSnapshot[]> {
    return [];
  }

  async getFreshness(): Promise<DataFreshness> {
    const health = realtimeHealth(await this.reads.workerHealth());
    return {
      fresh: health === 'live',
      refreshedAt: Date.now(),
      source: 'sql',
      resolvedChainSlug: null,
    };
  }

  private toToken(row: {
    tokenId: number;
    name: string | null;
    imageUrl: string | null;
    ownerAddress: string | null;
    price: number | null;
    currency: string | null;
    orderHash: string | null;
    listedAt: number | null;
  }): Token {
    return {
      tokenId: String(row.tokenId),
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: ROBINHOOD_CHAIN.id,
      imageUrl: row.imageUrl ?? buildTokenImageUrl(String(row.tokenId)),
      name: row.name,
      listingPrice: row.price,
      currency: row.currency ?? DEFAULT_PAYMENT_CURRENCY,
      listingOrderHash: row.orderHash,
      lastSalePrice: null,
      ownerAddress: row.ownerAddress,
      traits: [],
      rarityRank: null,
      listedAt: row.listedAt != null ? Math.floor(row.listedAt / 1000) : null,
      lastSaleAt: null,
    };
  }
}
