/**
 * A4 SQL MarketSource. Request-path reads from normalized tables.
 * Does not rehydrate TokenCatalog. Worker ingest still uses OpenSeaMarketSource.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { VIRTUAL_COLLECTION_CATALOG, classifyNumber, type NumberTrait, type TokenFacet } from '@net-vision/taxonomy';
import { DEFAULT_PAYMENT_CURRENCY, type CategoryMetrics, type CollectionSnapshot, type DataFreshness, type Token } from './types';
import { resolveTokenImageUrl } from '../data/media';
import type { MarketSource, ListTokensFilter, ListTokensPage, Offer, Sale, SalesWindow } from './source';
import { MS_DAY, previewFloorSweep, type SweepPreview, type SweepPreviewInput, type FloorSnapshot } from './engine';
import {
  bootstrapCoverage,
  bootstrapMarketStatus,
  categoryFloors,
  realtimeHealth,
} from './sql-readiness';
import { guardCollectionSnapshot } from './impossible-states';
import type { CategoryMarketFacts, MarketReadRepository } from '../index/market-read-repository';
import { emptyCategoryFacts, PgMarketReadRepository } from '../index/market-read-repository';
import { BUTTON_PRESSER_COLLECTION_ID } from '../index/schema-v2';
import { getPool } from '../index/pg';

let sqlSingleton: SqlMarketSource | null = null;

/** OpenSea path slug for fulfillment. Not discovered from the blob catalog. */
function resolvedOpenSeaChainSlug(): string {
  const hint = process.env.OPENSEA_CHAIN?.trim();
  return hint && hint.length > 0 ? hint : 'robinhood';
}

export function getSqlMarketSourceOrFail(): SqlMarketSource {
  if (sqlSingleton) return sqlSingleton;
  const pool = getPool();
  if (!pool) {
    throw new Error('MARKET_READ_MODEL=sql requires DATABASE_URL');
  }
  sqlSingleton = new SqlMarketSource(new PgMarketReadRepository(pool));
  return sqlSingleton;
}

function windowSinceMs(window: SalesWindow | undefined): number | null {
  if (!window || window === 'all') return null;
  const now = Date.now();
  if (window === '24h') return now - MS_DAY;
  if (window === '7d') return now - 7 * MS_DAY;
  return now - 30 * MS_DAY;
}

type CategorySaleStats = {
  latest: { tokenId: string; price: number; occurredAt: number } | null;
  highest: { tokenId: string; price: number; occurredAt: number } | null;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volumeAll: number;
  sales24h: number;
  sales7d: number;
  sales30d: number;
};

function saleStatsFromRows(
  rows: Array<{ tokenId: number; price: number; occurredAt: number }>,
): CategorySaleStats {
  if (rows.length === 0) {
    return {
      latest: null,
      highest: null,
      volume24h: 0,
      volume7d: 0,
      volume30d: 0,
      volumeAll: 0,
      sales24h: 0,
      sales7d: 0,
      sales30d: 0,
    };
  }
  const now = Date.now();
  const inWindow = (ms: number) => rows.filter((row) => row.occurredAt >= now - ms);
  const sum = (list: typeof rows) => list.reduce((acc, row) => acc + row.price, 0);
  const d24 = inWindow(MS_DAY);
  const d7 = inWindow(7 * MS_DAY);
  const d30 = inWindow(30 * MS_DAY);
  const latest = {
    tokenId: String(rows[0].tokenId),
    price: rows[0].price,
    occurredAt: rows[0].occurredAt,
  };
  const highestRow = rows.reduce((best, row) => (row.price > best.price ? row : best), rows[0]);
  return {
    latest,
    highest: {
      tokenId: String(highestRow.tokenId),
      price: highestRow.price,
      occurredAt: highestRow.occurredAt,
    },
    volume24h: sum(d24),
    volume7d: sum(d7),
    volume30d: sum(d30),
    volumeAll: sum(rows),
    sales24h: d24.length,
    sales7d: d7.length,
    sales30d: d30.length,
  };
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
      openseaChainSlug: resolvedOpenSeaChainSlug(),
      totalSupply: facts.officialSupply,
      owners: null,
      listedCount: facts.listedCount,
      staleListedCount: facts.staleListedCount,
      listingCoverage: coverage,
      marketStatus: status,
      snapshotRevision: await this.reads.snapshotRevision(this.collectionId),
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
    const [state, identity, facets] = await Promise.all([
      this.reads.getMarketState(this.collectionId, id),
      this.reads.getTokenIdentity(this.collectionId, id),
      this.reads.listTokenFacets(this.collectionId, id),
    ]);
    if (!state && !identity) return null;
    const listed = state?.listingState === 'LISTED';
    return {
      tokenId: String(id),
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: ROBINHOOD_CHAIN.id,
      imageUrl: resolveTokenImageUrl(String(id), identity?.imageUrl),
      name: identity?.name ?? null,
      listingPrice: listed ? state?.price ?? null : null,
      currency: state?.currency ?? DEFAULT_PAYMENT_CURRENCY,
      listingOrderHash: listed ? state?.orderHash ?? null : null,
      lastSalePrice: null,
      ownerAddress: identity?.ownerAddress ?? state?.seller ?? null,
      traits: traitsForToken(String(id), facets),
      rarityRank: null,
      listedAt: listed && state?.listedAt != null ? Math.floor(state.listedAt / 1000) : null,
      lastSaleAt: null,
    };
  }

  async listTokens(filter: ListTokensFilter = {}): Promise<ListTokensPage> {
    const slug = filter.category ?? null;
    const limit = Math.min(filter.limit ?? 48, 200);
    const offset = filter.offset ?? 0;
    const facts = slug
      ? await this.reads.categoryFacts(this.collectionId, slug)
      : await this.reads.collectionFacts(this.collectionId);
    const listedCount = facts?.listedCount ?? 0;
    const rows = await this.reads.listListedTokens(this.collectionId, slug, limit, offset);
    return { tokens: rows.map((row) => this.toToken(row)), total: listedCount };
  }

  async getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
    const meta = VIRTUAL_COLLECTION_CATALOG.find((entry) => entry.slug === slug);
    if (!meta) return null;
    const [facts, snapshot, health, saleStats] = await Promise.all([
      this.reads.categoryFacts(this.collectionId, slug),
      this.getCollectionSnapshot(),
      this.reads.workerHealth(),
      this.categorySaleStats(slug),
    ]);
    return this.metricsFromFacts(
      meta,
      facts ?? emptyCategoryFacts(slug),
      snapshot,
      realtimeHealth(health),
      saleStats,
    );
  }

  async listCategories(): Promise<CategoryMetrics[]> {
    const [snapshot, facts, health, sales] = await Promise.all([
      this.getCollectionSnapshot(),
      this.reads.allCategoryFacts(this.collectionId),
      this.reads.workerHealth(),
      this.reads.listAllCategorySales(this.collectionId),
    ]);
    const bySlug = new Map(facts.map((row) => [row.slug, row]));
    const salesBySlug = new Map<string, typeof sales>();
    for (const row of sales) {
      const list = salesBySlug.get(row.slug) ?? [];
      list.push(row);
      salesBySlug.set(row.slug, list);
    }
    const realtime = realtimeHealth(health);
    return VIRTUAL_COLLECTION_CATALOG.map((entry) =>
      this.metricsFromFacts(
        entry,
        bySlug.get(entry.slug) ?? emptyCategoryFacts(entry.slug),
        snapshot,
        realtime,
        saleStatsFromRows(salesBySlug.get(entry.slug) ?? []),
      ),
    );
  }

  async listRecentSales(limit = 20): Promise<Sale[]> {
    const rows = await this.reads.listRecentSales(this.collectionId, Math.min(limit, 100));
    return rows.map((row) => this.toSale(row));
  }

  async listTokenSales(tokenId: string, limit = 20): Promise<Sale[]> {
    const id = Number(tokenId);
    if (!Number.isInteger(id)) return [];
    const rows = await this.reads.listTokenSales(this.collectionId, id, Math.min(limit, 100));
    return rows.map((row) => this.toSale(row));
  }

  async listRecentOffers(_limit?: number): Promise<Offer[]> {
    return [];
  }

  async getTokenOffers(_tokenId: string): Promise<Offer[]> {
    return [];
  }

  async getAccountListings(address: string): Promise<Token[]> {
    const tokens = await this.listAccountTokens(address);
    return tokens.filter((token) => token.listingPrice != null);
  }

  async getAccountOffers(_address: string): Promise<Offer[]> {
    return [];
  }

  async listAccountTokens(address: string): Promise<Token[]> {
    const rows = await this.reads.listAccountTokens(this.collectionId, address);
    return rows.map((row) => this.toToken(row));
  }

  async listCategorySales(slug: string, options?: { window?: SalesWindow; limit?: number }): Promise<Sale[]> {
    const limit = Math.min(options?.limit ?? 40, 100);
    const sinceMs = windowSinceMs(options?.window);
    const rows = await this.reads.listCategorySales(this.collectionId, slug, limit, sinceMs);
    return rows.map((row) => this.toSale(row));
  }

  async listCategoryTopSales(slug: string, limit = 10): Promise<Sale[]> {
    const rows = await this.reads.listCategorySales(this.collectionId, slug, 200, null);
    return [...rows]
      .sort((a, b) => b.price - a.price)
      .slice(0, limit)
      .map((row) => this.toSale(row));
  }

  async listCategoryOffers(_slug: string, _limit?: number): Promise<Offer[]> {
    return [];
  }

  async previewSweep(slug: string, input: SweepPreviewInput): Promise<SweepPreview> {
    const rows = await this.reads.listListedTokens(this.collectionId, slug, 200, 0);
    const listings = rows
      .filter((row) => row.price != null && Number.isFinite(row.price))
      .map((row) => ({
        tokenId: String(row.tokenId),
        price: row.price as number,
        currency: row.currency ?? DEFAULT_PAYMENT_CURRENCY,
        listedAt: row.listedAt,
        ownerAddress: row.ownerAddress,
        orderHash: row.orderHash,
      }));
    const preview = previewFloorSweep(listings, input);
    const byId = new Map(rows.map((row) => [String(row.tokenId), row]));
    return {
      ...preview,
      items: preview.items.map((item) => {
        const row = byId.get(item.tokenId);
        return {
          ...item,
          contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
          chainId: ROBINHOOD_CHAIN.id,
          imageUrl: resolveTokenImageUrl(item.tokenId, row?.imageUrl ?? null),
          name: row?.name ?? `#${item.tokenId}`,
          listingPriceRaw: row?.price != null ? String(Math.round(row.price * 1_000_000)) : null,
        };
      }),
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
      resolvedChainSlug: resolvedOpenSeaChainSlug(),
    };
  }

  private metricsFromFacts(
    meta: (typeof VIRTUAL_COLLECTION_CATALOG)[number],
    facts: CategoryMarketFacts,
    snapshot: CollectionSnapshot,
    health: ReturnType<typeof realtimeHealth>,
    saleStats: CategorySaleStats,
  ): CategoryMetrics {
    const expected = expectedSupply(meta.slug, facts.memberCount);
    const membershipCoverage =
      meta.source === 'metadata' ? bootstrapCoverage(facts.memberCount, expected) : 1;
    const coverage = bootstrapCoverage(facts.establishedCount, expected);
    const status = bootstrapMarketStatus(Math.min(membershipCoverage, coverage));
    const floors = categoryFloors(
      facts.floorPrice != null ? [facts.floorPrice] : [],
      facts.lastKnownFloor != null ? [facts.lastKnownFloor] : [],
    );
    return {
      slug: meta.slug,
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
      lastSalePrice: saleStats.latest?.price ?? null,
      topOfferPrice: null,
      offerCount: 0,
      topSalePrice: saleStats.highest?.price ?? null,
      highestSale: saleStats.highest,
      volume24h: saleStats.volume24h,
      volume7d: saleStats.volume7d,
      volume30d: saleStats.volume30d,
      volumeAllTracked: saleStats.volumeAll,
      volume24hNative: 0,
      volume7dNative: 0,
      sales24h: saleStats.sales24h,
      sales7d: saleStats.sales7d,
      sales30d: saleStats.sales30d,
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

  private async categorySaleStats(slug: string): Promise<CategorySaleStats> {
    const rows = await this.reads.listCategorySales(this.collectionId, slug, 500, null);
    return saleStatsFromRows(rows);
  }

  private toSale(row: {
    tokenId: number;
    price: number;
    currency: string;
    occurredAt: number;
    orderHash: string | null;
    buyer: string | null;
    seller: string | null;
  }): Sale {
    return {
      tokenId: String(row.tokenId),
      price: row.price,
      currency: row.currency,
      occurredAt: row.occurredAt,
      orderHash: row.orderHash,
      buyer: row.buyer,
      seller: row.seller,
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
      imageUrl: resolveTokenImageUrl(String(row.tokenId), row.imageUrl),
      name: row.name,
      listingPrice: row.price,
      currency: row.currency ?? DEFAULT_PAYMENT_CURRENCY,
      listingOrderHash: row.orderHash,
      lastSalePrice: null,
      ownerAddress: row.ownerAddress,
      traits: traitsForToken(String(row.tokenId), []),
      rarityRank: null,
      listedAt: row.listedAt != null ? Math.floor(row.listedAt / 1000) : null,
      lastSaleAt: null,
    };
  }
}

function traitsForToken(tokenId: string, facets: TokenFacet[]): NumberTrait[] {
  const derived = classifyNumber(tokenId).traits;
  const seen = new Set(derived.map((trait) => trait.slug));
  const extra: NumberTrait[] = [];
  for (const facet of facets) {
    if (seen.has(facet.slug)) continue;
    if (
      facet.family === 'material' ||
      facet.family === 'number' ||
      facet.family === 'pattern' ||
      facet.family === 'culture'
    ) {
      extra.push({ slug: facet.slug, family: facet.family, label: facet.label });
      seen.add(facet.slug);
    }
  }
  return [...derived, ...extra];
}
