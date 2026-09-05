/**
 * Chain discovery and OpenSea-backed market source.
 *
 * The market source is the only place in the web app that talks to
 * OpenSea. Every request goes through the @net-vision/opensea-client
 * gateway, which validates responses with Zod and keeps the API key
 * server-side.
 *
 * The chain slug is discovered from /api/v2/chains at boot rather than
 * hard-coded. The resolved slug is cached in module scope; if discovery
 * fails, the source fails closed and surfaces the failure in
 * getFreshness() so the UI can render a clear "data unavailable" state
 * rather than fabricate numbers.
 *
 * On every read we lazily populate an in-memory cache keyed by token id
 * or category slug. The cache TTL is short; for P0 we keep it simple.
 */

import {
  BUTTON_PRESSER_COLLECTION,
  ROBINHOOD_CHAIN,
} from '@net-vision/chain-config';
import {
  classifyNumber,
  enumerateMembers,
  extractMetadataFacets,
  facetsForToken,
  isMember,
  VIRTUAL_COLLECTION_CATALOG,
  type NumberTrait,
  type MemberSet,
} from '@net-vision/taxonomy';
import {
  createOpenSeaClient,
  type AssetEvent,
  type ChainInfo,
  type NftInfo,
  type Order,
} from '@net-vision/opensea-client';
import {
  TokenCatalog,
  type CatalogListing,
  type CatalogSale,
  type CategoryTotals,
} from './catalog';
import { isMissingOpenSeaResource, isOpenSeaRateLimited } from './opensea-errors';
import {
  allAttributions,
  allListingRecords,
  allSales,
  appendFloorSnapshot,
  floorHistory as storedFloorHistory,
  historyStartedAt,
  ingestSales,
  hydrateIndexFromPostgres,
  listingRecord,
  loadIndex,
  persistNftMetadata,
  saveIndex,
  tokenFacets,
  writeListing,
} from '@/lib/index/store';
import { PRIORITY_TOKEN_IDS, startBackgroundIndexer } from '@/lib/index/worker';
import {
  applyListedPercentage,
  attributeSale,
  computeCategoryMarketStats,
  previewFloorSweep,
  trendingComponentsFromStats,
  trendingScore,
  type FloorSnapshot,
  type SweepPreview,
  type SweepPreviewInput,
  MS_DAY,
} from './engine';
import {
  applyObservation,
  categoryReadiness,
  type ListingObservation,
} from './listing-state';
import { buildTokenImageUrl } from '@/lib/data/media';
import type {
  CategoryMetrics,
  CollectionSnapshot,
  DataFreshness,
  Token,
} from './types';
import type {
  ListTokensFilter,
  ListTokensPage,
  MarketSource,
  Offer,
  Sale,
  SalesWindow,
} from './source';
import { DEFAULT_PAYMENT_CURRENCY } from './types';

type Env = {
  OPENSEA_API_KEY?: string;
  OPENSEA_BASE_URL?: string;
  OPENSEA_CHAIN?: string;
};

type CacheEntry<T> = {
  value: T;
  /** epoch ms */
  fetchedAt: number;
};

const TTL_MS = 60_000;
const MAX_LISTING_PAGE_SIZE = 1000;
const ORDERBOOK_PAGE_SIZE = 200;
const NFT_METADATA_CONCURRENCY = 4;
const VISIBLE_CONFIRM_CONCURRENCY = 4;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const VISIBLE_CONFIRM_BUDGET_MS = 1_500;

type TokenCacheEntry = CacheEntry<Token>;
type NftCacheEntry = CacheEntry<NftInfo>;
type CollectionCacheEntry = CacheEntry<CollectionSnapshot>;
type CategoryCacheEntry = CacheEntry<CategoryMetrics>;
type TokensPageCacheEntry = CacheEntry<ListTokensPage>;
type OffersCacheEntry = CacheEntry<Offer[]>;
type SalesCacheEntry = CacheEntry<Sale[]>;

type PriceTuple = {
  currency: string;
  decimals: number;
  value: string | number;
};

type OpenSeaClient = ReturnType<typeof createOpenSeaClient>;

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < TTL_MS;
}

function readEnv(): Env {
  return {
    OPENSEA_API_KEY: process.env.OPENSEA_API_KEY,
    OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
    OPENSEA_CHAIN: process.env.OPENSEA_CHAIN,
  };
}

function isMissingResource(err: unknown): boolean {
  return isMissingOpenSeaResource(err);
}

function normalizeAddress(value: string | undefined | null): string | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value.toLowerCase();
}

function parseEpoch(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }
  if (typeof value !== 'string') return null;
  if (/^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed > 1e12 ? Math.floor(parsed / 1000) : parsed;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
}

function isPriceTuple(value: unknown): value is PriceTuple {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PriceTuple>;
  return (
    typeof candidate.currency === 'string' &&
    candidate.currency.length > 0 &&
    typeof candidate.decimals === 'number' &&
    Number.isInteger(candidate.decimals) &&
    candidate.decimals >= 0 &&
    candidate.decimals <= 36 &&
    (typeof candidate.value === 'string' || typeof candidate.value === 'number')
  );
}

function getOrderPrice(order: Order): { amount: number | null; currency: string | null } {
  const envelope = order.price as unknown;
  const current = isPriceTuple((envelope as { current?: unknown } | null)?.current)
    ? ((envelope as { current: PriceTuple }).current as PriceTuple)
    : isPriceTuple(envelope)
      ? (envelope as PriceTuple)
      : null;
  if (!current) return { amount: null, currency: null };

  const amount = Number(current.value);
  if (!Number.isFinite(amount)) return { amount: null, currency: current.currency };
  return { amount: amount / 10 ** current.decimals, currency: current.currency };
}

function getTokenIdFromOrder(order: Order): string | null {
  const identifier = order.asset?.identifier;
  if (identifier === undefined || identifier === null) return null;
  const tokenId = String(identifier);
  return /^\d+$/.test(tokenId) ? tokenId : null;
}

function getOfferTokenId(order: Order): string | null {
  const directId = getTokenIdFromOrder(order);
  if (directId) return directId;

  const consideration = order.protocol_data.parameters.consideration ?? [];
  const nftItem = consideration.find((item) => item.itemType === 2);
  if (!nftItem) return null;
  const tokenId = String(nftItem.identifierOrCriteria);
  return /^\d+$/.test(tokenId) ? tokenId : null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), values.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

class OpenSeaMarketSource implements MarketSource {
  private readonly client: OpenSeaClient;
  private readonly tokens: Map<string, TokenCacheEntry> = new Map();
  private readonly nfts: Map<string, NftCacheEntry> = new Map();
  private collectionCache: CollectionCacheEntry | undefined;
  private readonly categories: Map<string, CategoryCacheEntry> = new Map();
  private readonly tokenPages: Map<string, TokensPageCacheEntry> = new Map();
  private readonly collectionOrders: Map<number, CacheEntry<Order[]>> = new Map();
  private readonly unlistedCategoryTokens: Map<string, CacheEntry<string[]>> = new Map();
  private readonly catalog: TokenCatalog;
  private orderbookIngestedAt = 0;
  private salesIngestedAt = 0;
  private rateLimitedUntil = 0;
  private readonly sales: Map<string, SalesCacheEntry> = new Map();
  private readonly offers: Map<string, OffersCacheEntry> = new Map();
  private readonly tokenOffers: Map<string, OffersCacheEntry> = new Map();
  private readonly accountListings: Map<string, CacheEntry<Token[]>> = new Map();
  private readonly accountOffers: Map<string, OffersCacheEntry> = new Map();
  private resolvedChain: ChainInfo | undefined;
  private resolvedChainError: string | null = null;
  /** Per-slug precomputed member set keyed by supply range. */
  private readonly memberSets: Map<string, MemberSet> = new Map();

  constructor(client: OpenSeaClient) {
    this.client = client;
    this.catalog = new TokenCatalog({
      minTokenId: BUTTON_PRESSER_COLLECTION.minTokenId,
      maxTokenId: BUTTON_PRESSER_COLLECTION.maxTokenId,
    });
    this.hydrateFromIndex();
    void hydrateIndexFromPostgres()
      .then((restored) => {
        if (restored) this.hydrateFromIndex();
      })
      .catch(() => {
        /* Postgres optional until DATABASE_URL + schema are live */
      });
    startBackgroundIndexer(
      (tokenId) => this.lookupListingObservation(tokenId),
      (record) => {
        this.catalog.hydrateListingRecord(record);
        this.categories.clear();
        this.tokenPages.clear();
      },
      async (tokenId) => {
        const nft = await this.fetchNFT(tokenId);
        return nft !== null;
      },
    );
  }

  private hydrateFromIndex(): void {
    const snap = loadIndex();
    for (const record of allListingRecords()) {
      this.catalog.hydrateListingRecord(record);
    }
    for (const [tokenId, facets] of Object.entries(snap.tokenFacets ?? {})) {
      this.catalog.attachFacets(tokenId, facets);
    }
    this.catalog.ingestSales(snap.sales ?? []);
  }

  private async lookupListingObservation(tokenId: string): Promise<ListingObservation> {
    if (this.isCoolingDown()) {
      throw new Error('opensea-cooling-down');
    }
    try {
      const listing = await this.client.getBestListing({
        slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
        tokenId,
      });
      if (!listing) return { kind: 'no-ask' };
      const catalogListing = orderToCatalogListing(listing);
      if (!catalogListing) return { kind: 'no-ask' };
      return {
        kind: 'ask',
        price: catalogListing.price,
        currency: catalogListing.currency,
        orderHash: catalogListing.orderHash,
        seller: catalogListing.ownerAddress,
        listedAt: catalogListing.listedAt,
      };
    } catch (err) {
      if (isMissingResource(err)) return { kind: 'no-ask' };
      if (isOpenSeaRateLimited(err)) this.noteRateLimit();
      throw err;
    }
  }

  private membersFor(slug: string): MemberSet {
    const cached = this.memberSets.get(slug);
    if (cached) return cached;
    const range = {
      minTokenId: BUTTON_PRESSER_COLLECTION.minTokenId,
      maxTokenId: BUTTON_PRESSER_COLLECTION.maxTokenId,
    };
    const set = enumerateMembers(slug, range);
    this.memberSets.set(slug, set);
    return set;
  }

  private getUnlistedCategoryTokenIds(
    category: string,
    facets: string[] | undefined,
    listedTokenIds: Set<string>,
  ): string[] {
    const cacheKey = JSON.stringify({ category, facets: facets ?? [] });
    const cached = this.unlistedCategoryTokens.get(cacheKey);
    if (isFresh(cached)) return cached.value;

    const tokenIds = this.membersFor(category).members
      .filter((tokenId) => !listedTokenIds.has(tokenId))
      .filter((tokenId) =>
        matchesCategoryFilter(buildUnlistedCategoryToken(tokenId), {
          category,
          facets,
        }),
      );
    this.unlistedCategoryTokens.set(cacheKey, {
      value: tokenIds,
      fetchedAt: Date.now(),
    });
    return tokenIds;
  }

  private getChainSlug(): string {
    return this.resolvedChain?.chain ?? '';
  }

  private async ensureChain(): Promise<ChainInfo | null> {
    if (this.resolvedChain) return this.resolvedChain;
    if (this.resolvedChainError) return null;
    try {
      this.resolvedChain = await this.client.resolveChainSlug();
      return this.resolvedChain;
    } catch (err) {
      this.resolvedChainError = err instanceof Error ? err.message : String(err);
      return null;
    }
  }

  private async fetchNFT(tokenId: string): Promise<NftInfo | null> {
    const cached = this.nfts.get(tokenId);
    if (isFresh(cached)) return cached.value;
    const chain = await this.ensureChain();
    if (!chain) return null;
    try {
      const nft = await this.client.getNFT({
        chain: chain.chain,
        contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
        tokenId,
      });
      this.nfts.set(tokenId, { value: nft, fetchedAt: Date.now() });
      const facets = persistNftMetadata(tokenId, {
        name: nft.name ?? null,
        imageUrl: nft.display_image_url ?? nft.image_url ?? null,
        ownerAddress: nftOwnerAddress(nft),
        traits: nft.traits,
      });
      this.catalog.attachFacets(tokenId, facets);
      return nft;
    } catch (err) {
      if (!isMissingResource(err)) {
        console.error(`OpenSea NFT lookup failed for ${tokenId}: ${err instanceof Error ? err.message : String(err)}`);
      }
      return null;
    }
  }

  async getToken(tokenId: string): Promise<Token | null> {
    const cached = this.tokens.get(tokenId);
    if (isFresh(cached)) return cached.value;

    const chain = await this.ensureChain();
    if (!chain) return null;

    const [nft, listing] = await Promise.all([
      this.fetchNFT(tokenId),
      this.client
        .getBestListing({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          tokenId,
        })
        .catch((err: unknown) => {
          if (!isMissingResource(err) && !(err instanceof Error)) {
            console.error(`OpenSea best-listing lookup failed for ${tokenId}: ${String(err)}`);
          }
          return null;
        }),
    ]);

    const catalogListing = listing ? orderToCatalogListing(listing) : null;
    this.catalog.confirmScan(tokenId, catalogListing);

    if (!nft && !listing) return null;
    const listedToken = listing ? orderToListedToken(listing) : null;
    const token = nft ? nftToToken(tokenId, nft) : listedToken;
    let finalToken: Token | null = token;
    if (token && listedToken && nft) {
      finalToken = mergeListedTokenWithNft(listedToken, nft);
    }
    const lastSale = this.catalog.lastSaleFor(tokenId);
    if (finalToken && lastSale) {
      finalToken = {
        ...finalToken,
        lastSalePrice: lastSale.price,
        lastSaleAt: lastSale.occurredAt,
        currency: finalToken.currency || lastSale.currency,
      };
    }
    if (finalToken) this.tokens.set(tokenId, { value: finalToken, fetchedAt: Date.now() });
    return finalToken;
  }

  async listTokens(filter?: ListTokensFilter): Promise<ListTokensPage> {
    const key = JSON.stringify(filter ?? {});
    const cached = this.tokenPages.get(key);
    if (isFresh(cached)) return cached.value;
    await this.ensurePipeline();
    const page = await this.fetchListingsPage(filter);
    this.tokenPages.set(key, { value: page, fetchedAt: Date.now() });
    return page;
  }

  private isCoolingDown(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  private noteRateLimit(): void {
    this.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  }

  private async ensurePipeline(): Promise<void> {
    this.catalog.classify();
    const chain = await this.ensureChain();
    if (!chain) return;
    await Promise.all([this.ingestOrderbook(), this.ingestCollectionSales()]);
  }

  private async ingestOrderbook(): Promise<Order[]> {
    const cached = this.collectionOrders.get(ORDERBOOK_PAGE_SIZE);
    const stale = cached?.value ?? [];
    if (isFresh(cached)) return cached.value;
    if (this.isCoolingDown()) return stale;
    // Prefer `/best` (price-ascending floors) and merge `/all` (recent asks).
    // `/all` alone is not reliably price-sorted on Robinhood and was missing
    // digit-range floors while returning high token ids at 1.25 USDG.
    let bestPage: { listings: Order[] } = { listings: [] };
    let allPage: { listings: Order[] } = { listings: [] };
    try {
      const [bestResult, allResult] = await Promise.allSettled([
        this.client.getCollectionBestListings({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          limit: ORDERBOOK_PAGE_SIZE,
        }),
        this.client.getCollectionListings({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          limit: ORDERBOOK_PAGE_SIZE,
        }),
      ]);
      if (bestResult.status === 'fulfilled') bestPage = bestResult.value;
      else if (isOpenSeaRateLimited(bestResult.reason)) this.noteRateLimit();
      if (allResult.status === 'fulfilled') allPage = allResult.value;
      else if (isOpenSeaRateLimited(allResult.reason)) this.noteRateLimit();
      if (bestResult.status === 'rejected' && allResult.status === 'rejected') {
        console.error(
          `OpenSea orderbook ingest failed: ${bestResult.reason instanceof Error ? bestResult.reason.message : String(bestResult.reason)}`,
        );
        return stale;
      }
    } catch (err) {
      if (isOpenSeaRateLimited(err)) this.noteRateLimit();
      console.error(
        `OpenSea orderbook ingest failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return stale;
    }
    const unique = new Map<string, Order>();
    for (const order of [...bestPage.listings, ...allPage.listings]) {
      const catalogListing = orderToCatalogListing(order);
      if (!catalogListing) continue;
      const existing = unique.get(catalogListing.tokenId);
      if (!existing) {
        unique.set(catalogListing.tokenId, order);
        continue;
      }
      const existingPrice = orderToCatalogListing(existing);
      if (existingPrice && catalogListing.price < existingPrice.price) {
        unique.set(catalogListing.tokenId, order);
      }
    }
    const orders = [...unique.values()];
    const catalogListings = orders
      .map(orderToCatalogListing)
      .filter((listing): listing is CatalogListing => listing !== null);
    this.catalog.ingestListings(catalogListings);
    // Persist orderbook asks into the durable index so a worker false
    // "no-ask" (e.g. #966) cannot stick as UNLISTED_VERIFIED while OpenSea
    // still shows the floor listing.
    for (const listing of catalogListings) {
      const next = applyObservation(listingRecord(listing.tokenId), {
        kind: 'ask',
        price: listing.price,
        currency: listing.currency,
        orderHash: listing.orderHash,
        seller: listing.ownerAddress,
        listedAt: listing.listedAt,
      });
      writeListing(next);
      this.catalog.hydrateListingRecord(next);
    }
    saveIndex();
    this.collectionOrders.set(ORDERBOOK_PAGE_SIZE, { value: orders, fetchedAt: Date.now() });
    this.orderbookIngestedAt = Date.now();
    this.tokenPages.clear();
    this.categories.clear();
    // Re-check known floor examples even if the worker previously marked them unlisted.
    void this.confirmVisibleListings([...PRIORITY_TOKEN_IDS], { force: true });
    return orders;
  }

  private async ingestCollectionSales(): Promise<void> {
    if (Date.now() - this.salesIngestedAt < TTL_MS) return;
    try {
      const page = await this.client.getCollectionEvents({
        slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
        eventType: 'sale',
        limit: 50,
      });
      const events = page.asset_events ?? page.events ?? [];
      const sales = events
        .map(eventToCatalogSale)
        .filter((sale): sale is CatalogSale => sale !== null);
      this.catalog.ingestSales(sales);
      const attributions = sales.flatMap((sale) => {
        const stored = tokenFacets(sale.tokenId);
        const facets = stored.length > 0 ? stored : facetsForToken(sale.tokenId);
        return attributeSale(sale, facets);
      });
      ingestSales(sales, attributions);
      this.salesIngestedAt = Date.now();
    } catch (err) {
      console.error(
        `OpenSea collection sales failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.salesIngestedAt = Date.now();
    }
  }

  /**
   * Confirm only the tokens currently on screen. Never walk the full
   * supply: a collection-wide best-listing scan 429s OpenSea and takes
   * category pages down with it.
   *
   * Pass `force: true` to re-check already-scanned ids (priority floor
   * tokens that may have been wrongly marked UNLISTED_VERIFIED).
   */
  private async confirmVisibleListings(
    tokenIds: string[],
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (tokenIds.length === 0 || this.isCoolingDown()) return;
    const pending = options.force
      ? tokenIds
      : tokenIds.filter((tokenId) => !this.catalog.isScanned(tokenId));
    if (pending.length === 0) return;

    let stopped = false;
    const confirm = mapWithConcurrency(pending, VISIBLE_CONFIRM_CONCURRENCY, async (tokenId) => {
      if (stopped || this.isCoolingDown()) return;
      try {
        const listing = await this.client.getBestListing({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          tokenId,
        });
        const catalogListing = listing ? orderToCatalogListing(listing) : null;
        if (catalogListing) {
          this.catalog.confirmScan(tokenId, catalogListing);
          const next = applyObservation(listingRecord(tokenId), {
            kind: 'ask',
            price: catalogListing.price,
            currency: catalogListing.currency,
            orderHash: catalogListing.orderHash,
            seller: catalogListing.ownerAddress,
            listedAt: catalogListing.listedAt,
          });
          writeListing(next);
          this.catalog.hydrateListingRecord(next);
        } else if (!options.force) {
          // Force re-checks are ask-only. OpenSea's best-listing endpoint
          // 404s on Robinhood for tokens that still appear in the collection
          // orderbook (seen with floor #966 / #756) — never downgrade on that.
          this.catalog.confirmScan(tokenId, null);
          const next = applyObservation(listingRecord(tokenId), { kind: 'no-ask' });
          writeListing(next);
          this.catalog.hydrateListingRecord(next);
        }
      } catch (err) {
        if (isMissingResource(err)) {
          if (!options.force) this.catalog.confirmScan(tokenId, null);
          return;
        }
        if (isOpenSeaRateLimited(err)) {
          stopped = true;
          this.noteRateLimit();
          return;
        }
        console.error(
          `OpenSea best-listing confirm failed for ${tokenId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    await Promise.race([
      confirm,
      new Promise<void>((resolve) => setTimeout(resolve, VISIBLE_CONFIRM_BUDGET_MS)),
    ]);
    saveIndex();
  }

  private async fetchListingsPage(filter?: ListTokensFilter): Promise<ListTokensPage> {
    if (filter?.status === 'not-listed' && !filter.category) {
      return { tokens: [], total: 0 };
    }
    const want = Math.min(Math.max(filter?.limit ?? 60, 1), MAX_LISTING_PAGE_SIZE);
    const offset = Math.max(filter?.offset ?? 0, 0);

    if (filter?.category) {
      if (filter.status === 'not-listed') {
        const window = this.catalog
          .unlistedVerifiedIds(filter.category, filter.facets)
          .slice(offset, offset + want);
        await this.confirmVisibleListings(window);
        const unlistedIds = this.catalog.unlistedVerifiedIds(filter.category, filter.facets);
        return {
          tokens: unlistedIds.slice(offset, offset + want).map(buildUnlistedCategoryToken),
          total: unlistedIds.length,
        };
      }
      const listedIds = this.catalog.listedIds(filter.category, filter.facets);
      return {
        tokens: await this.hydrateListedTokens(listedIds.slice(offset, offset + want)),
        total: listedIds.length,
      };
    }

    const listedIds = this.catalog.listedIds();
    return {
      tokens: await this.hydrateListedTokens(listedIds.slice(offset, offset + want)),
      total: listedIds.length,
    };
  }

  private async hydrateListedTokens(tokenIds: string[]): Promise<Token[]> {
    // Build from the catalog first so the listings grid never depends on
    // per-token NFT fetches (those 429 and used to blank the API).
    const tokens = tokenIds.map((tokenId) => {
      const cached = this.tokens.get(tokenId);
      if (isFresh(cached) && cached.value.listingPrice !== null) return cached.value;
      const listing = this.catalog.listingFor(tokenId);
      if (!listing) return null;
      const listedToken = catalogListingToToken(listing, this.catalog.traitsFor(tokenId));
      const lastSale = this.catalog.lastSaleFor(tokenId);
      const withSale = lastSale
        ? { ...listedToken, lastSalePrice: lastSale.price, lastSaleAt: lastSale.occurredAt }
        : listedToken;
      this.tokens.set(tokenId, { value: withSale, fetchedAt: Date.now() });
      return withSale;
    });
    const ready = tokens.filter((token): token is Token => token !== null);
    // Best-effort image/name enrichment for the visible page only.
    if (!this.isCoolingDown()) {
      const missing = ready.filter((token) => !token.imageUrl).slice(0, 12);
      await mapWithConcurrency(missing, NFT_METADATA_CONCURRENCY, async (token) => {
        try {
          const nft = await this.fetchNFT(token.tokenId);
          if (!nft) return;
          const merged = mergeListedTokenWithNft(token, nft);
          this.tokens.set(token.tokenId, { value: merged, fetchedAt: Date.now() });
          const idx = ready.findIndex((row) => row.tokenId === token.tokenId);
          if (idx >= 0) ready[idx] = merged;
        } catch {
          /* keep catalog-only row */
        }
      });
    }
    return ready;
  }

  async getCollectionSnapshot(): Promise<CollectionSnapshot> {
    if (isFresh(this.collectionCache)) return this.collectionCache.value;
    await this.ensurePipeline();
    const chain = await this.ensureChain();
    const fallback: CollectionSnapshot = {
      name: BUTTON_PRESSER_COLLECTION.name,
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: ROBINHOOD_CHAIN.id,
      openseaChainSlug: chain?.chain ?? '',
      totalSupply: 0,
      owners: 0,
      listedCount: 0,
      currency: DEFAULT_PAYMENT_CURRENCY,
      floorPrice: null,
      volume24hNative: 0,
      volume7dNative: 0,
      sales24h: 0,
      sales7d: 0,
      topSalePrice: null,
      topOfferPrice: null,
      refreshedAt: Date.now(),
    };
    if (!chain) {
      this.collectionCache = { value: fallback, fetchedAt: Date.now() };
      return fallback;
    }

    const statsResult = await Promise.allSettled([
      this.client.getCollectionStats({ slug: BUTTON_PRESSER_COLLECTION.openseaSlug }),
    ]);
    const stats = statsResult[0]?.status === 'fulfilled' ? statsResult[0].value : undefined;
    if (!stats) {
      console.error(`OpenSea collection stats failed: ${statsResult[0]?.status === 'rejected' ? String(statsResult[0].reason) : 'unknown error'}`);
    }

    const oneDay = stats?.intervals?.find((interval) => interval.interval === 'one_day');
    const sevenDays = stats?.intervals?.find((interval) => interval.interval === 'seven_day');
    const snapshot: CollectionSnapshot = {
      ...fallback,
      totalSupply: stats?.total.total_supply ?? stats?.total.num_items ?? 0,
      owners: stats?.total.num_owners ?? 0,
      listedCount: this.catalog.listedCount,
      currency: stats?.total.floor_price_symbol ?? DEFAULT_PAYMENT_CURRENCY,
      floorPrice: stats?.total.floor_price ?? null,
      volume24hNative: oneDay?.volume ?? 0,
      volume7dNative: sevenDays?.volume ?? 0,
      sales24h: oneDay?.sales ?? 0,
      sales7d: sevenDays?.sales ?? 0,
      refreshedAt: Date.now(),
    };
    this.collectionCache = { value: snapshot, fetchedAt: Date.now() };
    return snapshot;
  }

  private async composeCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
    const meta = VIRTUAL_COLLECTION_CATALOG.find((entry) => entry.slug === slug);
    if (!meta) return null;
    const snapshot = await this.getCollectionSnapshot();
    const totals = this.catalog.categoryTotals(slug);
    const memberSupply =
      meta.source === 'metadata' && meta.expectedSupply ? meta.expectedSupply : totals.memberSupply;
    const listings = this.catalog
      .listedIds(slug)
      .map((tokenId) => this.catalog.listingFor(tokenId))
      .filter((row): row is CatalogListing => row !== undefined);
    const offers = await this.listRecentOffers(50).catch(() => [] as Offer[]);
    const stats = applyListedPercentage(
      computeCategoryMarketStats({
        slug,
        listings,
        attributions: allAttributions(),
        sales: allSales(),
        offers,
        floorHistory: storedFloorHistory(slug),
        trackedSince: historyStartedAt(),
      }),
      memberSupply,
    );
    const discoveredMembers =
      meta.source === 'metadata' ? this.catalog.memberIds(slug).length : memberSupply;
    const readiness = categoryReadiness({
      source: meta.source,
      expectedSupply: memberSupply,
      discoveredMembers,
      verifiedMarketMembers: totals.verifiedCount,
    });
    if (readiness.marketStatus === 'live') {
      appendFloorSnapshot(slug, {
        at: Date.now(),
        floor: stats.floorPrice,
        listed: stats.listedCount,
      });
    }
    const trend = trendingScore(
      trendingComponentsFromStats({
        volume24h: stats.volume24h,
        volume7d: stats.volume7d,
        sales24h: stats.sales24h,
        sales7d: stats.sales7d,
        floorChange24h: stats.floorChange24h,
        offerCount: stats.offerCount,
        listedCount: stats.listedCount,
        memberSupply,
      }),
    );
    const subFilter =
      slug === 'palindrome'
        ? {
            facets: ([2, 3, 4, 5] as const).map((digits) => {
              const facetTotals = this.catalog.categoryTotals('palindrome', [`digits-${digits}`]);
              return {
                value: `digits-${digits}`,
                label: `${digits} Digit`,
                memberCount: facetTotals.memberSupply,
                listedCount: facetTotals.listedCount,
              };
            }),
          }
        : undefined;
    const verifiedCount = totals.verifiedCount;
    const unknownCount = Math.max(memberSupply - verifiedCount, 0);
    const liveFloor = readiness.marketStatus === 'syncing' ? null : stats.floorPrice;
    return {
      slug,
      name: meta.name,
      family: meta.family,
      source: meta.source,
      description: meta.description,
      memberSupply,
      filteredMemberSupply: memberSupply,
      totalSupply: snapshot.totalSupply,
      listedCount: totals.listedCount,
      listedPercentage: stats.listedPercentage,
      verifiedCount,
      unknownCount,
      coveragePercent: Math.min(readiness.membershipCoverage, readiness.marketCoverage),
      membershipCoverage: readiness.membershipCoverage,
      marketCoverage: readiness.marketCoverage,
      marketStatus: readiness.marketStatus,
      owners: stats.owners,
      currency: snapshot.currency,
      floorPrice: liveFloor,
      ceilingPrice: readiness.marketStatus === 'syncing' ? null : stats.highestAsk,
      medianAsk: readiness.marketStatus === 'syncing' ? null : stats.medianAsk,
      lastSalePrice: stats.highestSale?.price ?? totals.lastSalePrice,
      topOfferPrice: stats.bestOffer,
      offerCount: stats.offerCount,
      topSalePrice: stats.highestSale?.price ?? null,
      highestSale: stats.highestSale
        ? {
            tokenId: stats.highestSale.tokenId,
            price: stats.highestSale.price,
            occurredAt: stats.highestSale.occurredAt,
          }
        : null,
      volume24h: stats.volume24h,
      volume7d: stats.volume7d,
      volume30d: stats.volume30d,
      volumeAllTracked: stats.volumeAllTracked,
      volume24hNative: 0,
      volume7dNative: 0,
      sales24h: stats.sales24h,
      sales7d: stats.sales7d,
      sales30d: stats.sales30d,
      averageSale: stats.averageSale,
      medianSale: stats.medianSale,
      floorChange24h: stats.floorChange24h,
      floorChange7d: stats.floorChange7d,
      floorChange30d: stats.floorChange30d,
      trendingScore: trend.score,
      trackedSince: stats.trackedSince,
      subFilter,
    };
  }

  async getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
    const cached = this.categories.get(slug);
    if (isFresh(cached)) return cached.value;
    await this.ensurePipeline();
    const metrics = await this.composeCategoryMetrics(slug);
    if (metrics) this.categories.set(slug, { value: metrics, fetchedAt: Date.now() });
    return metrics;
  }

  async listCategories(): Promise<CategoryMetrics[]> {
    await this.ensurePipeline();
    const rows: CategoryMetrics[] = [];
    for (const entry of VIRTUAL_COLLECTION_CATALOG) {
      const metrics = await this.composeCategoryMetrics(entry.slug);
      if (metrics) rows.push(metrics);
    }
    return rows;
  }

  async listRecentSales(limit = 20): Promise<Sale[]> {
    await this.ensurePipeline();
    return this.catalog.recentSales(limit).map(catalogSaleToSale);
  }

  async listTokenSales(tokenId: string, limit = 20): Promise<Sale[]> {
    await this.ensurePipeline();
    const cached = this.catalog.salesFor(tokenId, limit);
    if (cached.length > 0) return cached.map(catalogSaleToSale);
    const chain = await this.ensureChain();
    if (!chain) return [];
    try {
      const page = await this.client.getNftEvents({
        chain: chain.chain,
        contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
        tokenId,
        eventType: 'sale',
        limit,
      });
      const events = page.asset_events ?? page.events ?? [];
      const sales = events
        .map(eventToCatalogSale)
        .filter((sale): sale is CatalogSale => sale !== null);
      this.catalog.ingestSales(sales);
      return this.catalog.salesFor(tokenId, limit).map(catalogSaleToSale);
    } catch (err) {
      console.error(
        `OpenSea token sales failed for ${tokenId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  async listRecentOffers(limit = 20): Promise<Offer[]> {
    const cacheKey = `collection:${limit}`;
    const cached = this.offers.get(cacheKey);
    if (isFresh(cached)) return cached.value;
    const chain = await this.ensureChain();
    if (!chain) return [];
    const page = await this.client.getCollectionOffers({
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      limit: Math.min(Math.max(limit, 1), MAX_LISTING_PAGE_SIZE),
    });
    const offers = page.offers
      .map(orderToOffer)
      .filter((offer): offer is Offer => offer !== null)
      .sort((a, b) => b.price - a.price)
      .slice(0, limit);
    this.offers.set(cacheKey, { value: offers, fetchedAt: Date.now() });
    return offers;
  }

  async getTokenOffers(tokenId: string): Promise<Offer[]> {
    const cached = this.tokenOffers.get(tokenId);
    if (isFresh(cached)) return cached.value;
    const chain = await this.ensureChain();
    if (!chain) return [];
    try {
      const [pageOffers, best] = await Promise.all([
        this.client.getNftOffers({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          tokenId,
          limit: 50,
        }),
        this.client.getBestNftOffer({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          tokenId,
        }),
      ]);
      const merged = new Map<string, Offer>();
      for (const order of [...pageOffers, best]) {
        if (!order) continue;
        const offer = orderToOffer(order);
        if (offer) merged.set(offer.orderHash, offer);
      }
      const offers = [...merged.values()].sort((a, b) => b.price - a.price);
      this.tokenOffers.set(tokenId, { value: offers, fetchedAt: Date.now() });
      return offers;
    } catch (err) {
      console.error(
        `OpenSea token offers failed for ${tokenId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.tokenOffers.set(tokenId, { value: [], fetchedAt: Date.now() });
      return [];
    }
  }

  async getAccountListings(address: string): Promise<Token[]> {
    const cached = this.accountListings.get(address);
    if (isFresh(cached)) return cached.value;
    const orders = await this.client.getProfileListings({ address });
    const tokens = orders.map(orderToListedToken).filter((token): token is Token => token !== null);
    this.accountListings.set(address, { value: tokens, fetchedAt: Date.now() });
    return tokens;
  }

  async getAccountOffers(address: string): Promise<Offer[]> {
    const cached = this.accountOffers.get(address);
    if (isFresh(cached)) return cached.value;
    const orders = await this.client.getAccountOffers({ address });
    const offers = orders.map(orderToOffer).filter((offer): offer is Offer => offer !== null);
    this.accountOffers.set(address, { value: offers, fetchedAt: Date.now() });
    return offers;
  }

  async listAccountTokens(address: string): Promise<Token[]> {
    const chain = await this.ensureChain();
    if (!chain) return [];
    try {
      const page = await this.client.getAccountNfts({
        chain: chain.chain,
        address,
        collection: BUTTON_PRESSER_COLLECTION.openseaSlug,
        limit: 50,
      });
      const owned = page.nfts.filter((nft) => {
        const contract = nft.contract?.toLowerCase();
        return !contract || contract === BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase();
      });
      const tokens: Token[] = [];
      for (const nft of owned) {
        const tokenId = String(nft.identifier);
        if (!/^\d+$/.test(tokenId)) continue;
        persistNftMetadata(tokenId, {
          name: nft.name ?? null,
          imageUrl: nft.display_image_url ?? nft.image_url ?? null,
          ownerAddress: address.toLowerCase(),
          traits: nft.traits,
        });
        const listing = this.catalog.listingFor(tokenId);
        const token = nftToToken(tokenId, nft);
        tokens.push(
          listing
            ? {
                ...token,
                listingPrice: listing.price,
                currency: listing.currency,
                listedAt: listing.listedAt,
                ownerAddress: address.toLowerCase(),
              }
            : { ...token, ownerAddress: address.toLowerCase() },
        );
      }
      return tokens;
    } catch (err) {
      console.error(
        `OpenSea account NFTs failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.getAccountListings(address);
    }
  }

  async listCategorySales(
    slug: string,
    options: { window?: SalesWindow; limit?: number } = {},
  ): Promise<Sale[]> {
    await this.ensurePipeline();
    const now = Date.now();
    const windowMs =
      options.window === '24h'
        ? MS_DAY
        : options.window === '7d'
          ? 7 * MS_DAY
          : options.window === '30d'
            ? 30 * MS_DAY
            : null;
    const attributedIds = new Set(
      allAttributions()
        .filter((row) => row.categorySlug === slug)
        .map((row) => row.saleEventId),
    );
    const sales = allSales().filter((sale) => {
      const id = `${sale.orderHash ? `sale:${sale.orderHash}:${sale.tokenId}` : `sale:${sale.tokenId}:${sale.occurredAt}:${sale.price}`}`;
      if (!attributedIds.has(id) && !this.catalog.slugsFor(sale.tokenId).includes(slug)) {
        return false;
      }
      if (windowMs !== null && sale.occurredAt * 1000 < now - windowMs) return false;
      return true;
    });
    return sales.slice(0, options.limit ?? 50).map(catalogSaleToSale);
  }

  async listCategoryTopSales(slug: string, limit = 10): Promise<Sale[]> {
    const sales = await this.listCategorySales(slug, { window: 'all', limit: 200 });
    return [...sales].sort((a, b) => b.price - a.price).slice(0, limit);
  }

  async listCategoryOffers(slug: string, limit = 20): Promise<Offer[]> {
    const offers = await this.listRecentOffers(50);
    const members = new Set(this.catalog.memberIds(slug));
    return offers.filter((offer) => members.has(offer.tokenId)).slice(0, limit);
  }

  async previewSweep(slug: string, input: SweepPreviewInput): Promise<SweepPreview> {
    await this.ensurePipeline();
    const listings = this.catalog
      .listedIds(slug)
      .map((tokenId) => this.catalog.listingFor(tokenId))
      .filter((row): row is CatalogListing => row !== undefined);
    return previewFloorSweep(listings, input);
  }

  async floorHistory(slug: string): Promise<FloorSnapshot[]> {
    return storedFloorHistory(slug);
  }

  async getFreshness(): Promise<DataFreshness> {
    if (!this.collectionCache) await this.getCollectionSnapshot();
    const refreshedAt = this.collectionCache?.fetchedAt ?? null;
    const fresh = this.resolvedChain !== undefined && refreshedAt !== null && Date.now() - refreshedAt < TTL_MS;
    return {
      fresh: Boolean(fresh),
      refreshedAt,
      source: this.resolvedChain ? 'opensea' : 'fixture',
      resolvedChainSlug: this.resolvedChain?.chain ?? null,
    };
  }
}

function nftOwnerAddress(nft: NftInfo): string | null {
  const directOwner = normalizeAddress(nft.owner ?? null);
  if (directOwner) return directOwner;
  if (Array.isArray(nft.owners)) {
    const first = nft.owners[0];
    return typeof first === 'string' ? normalizeAddress(first) : normalizeAddress(first?.address ?? null);
  }
  return null;
}

function nftToToken(tokenId: string, nft: NftInfo): Token {
  const classification = classifyNumber(tokenId);
  const traits: NumberTrait[] = mergeTraits(classification.traits, nft.traits ?? []);
  return {
    tokenId,
    contractAddress:
      nft.contract?.toLowerCase() ?? BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl:
      nft.display_image_url ??
      nft.image_url ??
      nft.image_preview_url ??
      nft.image_original_url ??
      buildTokenImageUrl(tokenId),
    name: nft.name ?? `#${tokenId}`,
    description: nft.description ?? null,
    listingPrice: null,
    currency: DEFAULT_PAYMENT_CURRENCY,
    lastSalePrice: null,
    ownerAddress: nftOwnerAddress(nft),
    traits,
    rarityRank: nft.rarity?.rank ?? null,
    listedAt: null,
    lastSaleAt: null,
  };
}

function mergeListedTokenWithNft(token: Token, nft: NftInfo): Token {
  return {
    ...token,
    contractAddress: nft.contract?.toLowerCase() ?? token.contractAddress,
    imageUrl:
      nft.display_image_url ??
      nft.image_url ??
      nft.image_preview_url ??
      nft.image_original_url ??
      token.imageUrl,
    name: nft.name ?? token.name,
    ownerAddress: nftOwnerAddress(nft) ?? token.ownerAddress,
    traits: mergeTraits(token.traits, nft.traits ?? []),
    rarityRank: nft.rarity?.rank ?? token.rarityRank,
  };
}

function mergeTraits(
  base: NumberTrait[],
  openSeaTraits: NonNullable<NftInfo['traits']>,
): NumberTrait[] {
  const plate = extractMetadataFacets('_', { traits: openSeaTraits }).map((facet) => ({
    slug: facet.slug,
    family: 'material' as const,
    label: facet.label,
    metadata: facet.metadata,
  }));
  const seen = new Set(base.map((trait) => trait.slug));
  const extras = plate.filter((trait) => !seen.has(trait.slug));
  return [...base, ...extras];
}

function buildUnlistedCategoryToken(tokenId: string): Token {
  const classification = classifyNumber(tokenId);
  return {
    tokenId,
    contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl: buildTokenImageUrl(tokenId),
    name: `#${tokenId}`,
    listingPrice: null,
    currency: DEFAULT_PAYMENT_CURRENCY,
    lastSalePrice: null,
    ownerAddress: null,
    traits: classification.traits,
    rarityRank: null,
    listedAt: null,
    lastSaleAt: null,
  };
}

function catalogListingToToken(listing: CatalogListing, traits: NumberTrait[]): Token {
  return {
    tokenId: listing.tokenId,
    contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl: buildTokenImageUrl(listing.tokenId),
    name: `#${listing.tokenId}`,
    listingPrice: listing.price,
    currency: listing.currency,
    lastSalePrice: null,
    ownerAddress: listing.ownerAddress,
    traits,
    rarityRank: null,
    listedAt: listing.listedAt,
    lastSaleAt: null,
  };
}

function orderToCatalogListing(order: Order): CatalogListing | null {
  const tokenId = getTokenIdFromOrder(order);
  if (!tokenId) return null;
  const { amount, currency } = getOrderPrice(order);
  if (amount === null || !Number.isFinite(amount)) return null;
  return {
    tokenId,
    price: amount,
    currency: currency ?? DEFAULT_PAYMENT_CURRENCY,
    listedAt: parseEpoch(order.order_created_at ?? order.protocol_data.parameters.startTime),
    ownerAddress: normalizeAddress(order.protocol_data.parameters.offerer ?? null),
    orderHash: order.order_hash,
  };
}

function eventAddress(value: unknown): string | null {
  if (typeof value === 'string') return normalizeAddress(value);
  if (value && typeof value === 'object' && 'address' in value) {
    return normalizeAddress((value as { address?: string }).address ?? null);
  }
  return null;
}

function eventToCatalogSale(event: AssetEvent): CatalogSale | null {
  const tokenId = String(event.nft?.identifier ?? event.asset?.identifier ?? '');
  if (!/^\d+$/.test(tokenId)) return null;
  const quantity = event.payment?.quantity;
  const decimals = event.payment?.decimals ?? 0;
  if (quantity === undefined) return null;
  const amount = Number(quantity) / 10 ** decimals;
  if (!Number.isFinite(amount)) return null;
  const occurredAt = parseEpoch(event.event_timestamp ?? event.closing_date);
  if (occurredAt === null) return null;
  return {
    tokenId,
    price: amount,
    currency: event.payment?.symbol ?? event.payment?.currency ?? DEFAULT_PAYMENT_CURRENCY,
    occurredAt,
    orderHash: event.order_hash ?? null,
    buyer: eventAddress(event.buyer) ?? normalizeAddress(event.to_address ?? null),
    seller: eventAddress(event.seller) ?? normalizeAddress(event.from_address ?? null),
  };
}

function catalogSaleToSale(sale: CatalogSale): Sale {
  return {
    tokenId: sale.tokenId,
    price: sale.price,
    currency: sale.currency,
    occurredAt: sale.occurredAt,
    orderHash: sale.orderHash,
    buyer: sale.buyer,
    seller: sale.seller,
  };
}

function orderToListedToken(order: Order): Token | null {
  const tokenId = getTokenIdFromOrder(order);
  if (!tokenId) return null;
  const classification = classifyNumber(tokenId);
  const { amount, currency } = getOrderPrice(order);
  const listedAt = parseEpoch(
    order.order_created_at ?? order.protocol_data.parameters.startTime,
  );
  return {
    tokenId,
    contractAddress:
      order.asset?.contract?.toLowerCase() ?? BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl: buildTokenImageUrl(tokenId),
    name: `#${tokenId}`,
    listingPrice: amount,
    currency: currency ?? DEFAULT_PAYMENT_CURRENCY,
    lastSalePrice: null,
    ownerAddress: normalizeAddress(order.protocol_data.parameters.offerer ?? null),
    traits: classification.traits,
    rarityRank: null,
    listedAt,
    lastSaleAt: null,
  };
}

function orderToOffer(order: Order): Offer | null {
  const tokenId = getOfferTokenId(order);
  const maker = normalizeAddress(order.protocol_data.parameters.offerer ?? null);
  const { amount, currency } = getOrderPrice(order);
  if (!tokenId || !maker || amount === null) return null;
  return {
    tokenId,
    price: amount,
    currency: currency ?? DEFAULT_PAYMENT_CURRENCY,
    expiresAt: parseEpoch(order.protocol_data.parameters.endTime),
    orderHash: order.order_hash,
    maker,
  };
}

function buildPalindromeFacets(
  members: MemberSet,
  listed: Token[],
): NonNullable<CategoryMetrics['subFilter']> {
  const buckets = members.byDigitCount ?? {
    2: [],
    3: [],
    4: [],
    5: [],
  };
  const listedByDigits: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const token of listed) {
    const len = token.tokenId.length;
    if (len === 2 || len === 3 || len === 4 || len === 5) {
      listedByDigits[len] = (listedByDigits[len] ?? 0) + 1;
    }
  }
  return {
    facets: [2, 3, 4, 5].map((digits) => ({
      value: `digits-${digits}`,
      label: `${digits} Digit`,
      memberCount: buckets[digits as 2 | 3 | 4 | 5]?.length ?? 0,
      listedCount: listedByDigits[digits] ?? 0,
    })),
  };
}

/**
 * Resolve a `palindrome:digits-N` facet value to the corresponding
 * digit count, or null when not applicable. Used to drive the
 * digit-count sub-filter.
 */
function parsePalindromeFacetValue(value: string): 2 | 3 | 4 | 5 | null {
  const m = /^digits-([2-5])$/.exec(value);
  if (!m) return null;
  return Number(m[1]) as 2 | 3 | 4 | 5;
}

function matchesCategoryFilter(
  token: Token,
  filter?: ListTokensFilter,
): boolean {
  if (!filter?.category) return true;
  if (!isMember(filter.category, token.tokenId)) return false;
  const facets = filter.facets ?? [];
  if (facets.length === 0) return true;
  if (filter.category !== 'palindrome') return true;
  const len = token.tokenId.length;
  if (len !== 2 && len !== 3 && len !== 4 && len !== 5) return false;
  return facets.some((f) => {
    const digits = parsePalindromeFacetValue(f);
    return digits !== null && digits === len;
  });
}

let singleton: MarketSource | null = null;
let singletonError: string | null = null;

export function getMarketSource(): MarketSource {
  if (singleton) return singleton;
  if (singletonError) {
    return failingSource(singletonError);
  }
  try {
    const env = readEnv();
    if (!env.OPENSEA_API_KEY) {
      singletonError =
        'OPENSEA_API_KEY is not set; live market data is unavailable. Set it in the server environment.';
      return failingSource(singletonError);
    }
    const client = createOpenSeaClient({
      OPENSEA_API_KEY: env.OPENSEA_API_KEY,
      OPENSEA_BASE_URL: env.OPENSEA_BASE_URL,
      OPENSEA_CHAIN: env.OPENSEA_CHAIN,
    });
    singleton = new OpenSeaMarketSource(client);
    return singleton;
  } catch (err) {
    singletonError = err instanceof Error ? err.message : String(err);
    return failingSource(singletonError);
  }
}

class FailingMarketSource implements MarketSource {
  constructor(private readonly reason: string) {}
  async getCollectionSnapshot(): Promise<CollectionSnapshot> {
    return {
      name: BUTTON_PRESSER_COLLECTION.name,
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: ROBINHOOD_CHAIN.id,
      openseaChainSlug: '',
      totalSupply: 0,
      owners: 0,
      listedCount: 0,
      currency: DEFAULT_PAYMENT_CURRENCY,
      floorPrice: null,
      volume24hNative: 0,
      volume7dNative: 0,
      sales24h: 0,
      sales7d: 0,
      topSalePrice: null,
      topOfferPrice: null,
      refreshedAt: 0,
    };
  }
  async getToken(): Promise<Token | null> {
    return null;
  }
  async listTokens(): Promise<ListTokensPage> {
    return { tokens: [], total: 0 };
  }
  async getCategoryMetrics(): Promise<CategoryMetrics | null> {
    return null;
  }
  async listCategories(): Promise<CategoryMetrics[]> {
    return [];
  }
  async listRecentSales(): Promise<Sale[]> {
    return [];
  }
  async listTokenSales(): Promise<Sale[]> {
    return [];
  }
  async listRecentOffers(): Promise<Offer[]> {
    return [];
  }
  async getTokenOffers(): Promise<Offer[]> {
    return [];
  }
  async getAccountListings(): Promise<Token[]> {
    return [];
  }
  async getAccountOffers(): Promise<Offer[]> {
    return [];
  }
  async listAccountTokens(): Promise<Token[]> {
    return [];
  }
  async listCategorySales(): Promise<Sale[]> {
    return [];
  }
  async listCategoryTopSales(): Promise<Sale[]> {
    return [];
  }
  async listCategoryOffers(): Promise<Offer[]> {
    return [];
  }
  async previewSweep() {
    return { strategy: 'floor' as const, items: [], count: 0, total: 0, currency: 'USDG', truncated: false };
  }
  async floorHistory() {
    return [];
  }
  async getFreshness(): Promise<DataFreshness> {
    return {
      fresh: false,
      refreshedAt: null,
      source: 'fixture',
      resolvedChainSlug: null,
    };
  }
  describeFailure(): string {
    return this.reason;
  }
}

function failingSource(reason: string): MarketSource {
  return new FailingMarketSource(reason) as unknown as MarketSource;
}

export function describeMarketSourceFailure(): string | null {
  return singletonError;
}
