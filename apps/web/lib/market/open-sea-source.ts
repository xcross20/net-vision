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
import { classifyNumber, type NumberTrait } from '@net-vision/taxonomy';
import {
  createOpenSeaClient,
  type ChainInfo,
  type Order,
  type NftInfo,
} from '@net-vision/opensea-client';
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
} from './source';

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

type TokenCacheEntry = CacheEntry<Token>;
type CollectionCacheEntry = CacheEntry<CollectionSnapshot>;
type CategoryCacheEntry = CacheEntry<CategoryMetrics>;
type TokensPageCacheEntry = CacheEntry<ListTokensPage>;
type OffersCacheEntry = CacheEntry<Offer[]>;
type SalesCacheEntry = CacheEntry<Sale[]>;

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

type OpenSeaClient = ReturnType<typeof createOpenSeaClient>;

class OpenSeaMarketSource implements MarketSource {
  private readonly client: OpenSeaClient;
  private readonly tokens: Map<string, TokenCacheEntry> = new Map();
  private collectionCache: CollectionCacheEntry | undefined;
  private readonly categories: Map<string, CategoryCacheEntry> = new Map();
  private readonly tokenPages: Map<string, TokensPageCacheEntry> = new Map();
  private readonly sales: SalesCacheEntry | undefined = undefined;
  private readonly offers: OffersCacheEntry | undefined = undefined;
  private readonly tokenOffers: Map<string, OffersCacheEntry> = new Map();
  private readonly accountListings: Map<string, CacheEntry<Token[]>> = new Map();
  private readonly accountOffers: Map<string, OffersCacheEntry> = new Map();
  private resolvedChain: ChainInfo | undefined;
  private resolvedChainError: string | null = null;
  private resolvedAt: number | null = null;

  constructor(client: OpenSeaClient) {
    this.client = client;
  }

  private getChainSlug(): string {
    return this.resolvedChain?.chain ?? '';
  }

  private async ensureChain(): Promise<ChainInfo | null> {
    if (this.resolvedChain) return this.resolvedChain;
    if (this.resolvedChainError) return null;
    try {
      this.resolvedChain = await this.client.resolveChainSlug();
      this.resolvedAt = Date.now();
      return this.resolvedChain;
    } catch (err) {
      this.resolvedChainError = err instanceof Error ? err.message : String(err);
      return null;
    }
  }

  private async fetchNFT(tokenId: string): Promise<Token | null> {
    const chain = await this.ensureChain();
    if (!chain) return null;
    try {
      const nft: NftInfo = await this.client.getNFT({
        chain: chain.chain,
        contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
        tokenId,
      });
      return nftToToken(tokenId, nft);
    } catch {
      // The indexer may not know about this token yet. Return null.
      return null;
    }
  }

  async getToken(tokenId: string): Promise<Token | null> {
    const cached = this.tokens.get(tokenId);
    if (isFresh(cached)) return cached.value;
    const fresh = await this.fetchNFT(tokenId);
    if (fresh) this.tokens.set(tokenId, { value: fresh, fetchedAt: Date.now() });
    return fresh;
  }

  async listTokens(filter?: ListTokensFilter): Promise<ListTokensPage> {
    const key = JSON.stringify(filter ?? {});
    const cached = this.tokenPages.get(key);
    if (isFresh(cached)) return cached.value;
    const chain = await this.ensureChain();
    const page: ListTokensPage = chain
      ? await this.fetchListingsPage(chain.chain, filter)
      : { tokens: [], total: 0 };
    this.tokenPages.set(key, { value: page, fetchedAt: Date.now() });
    return page;
  }

  private async fetchListingsPage(
    chainSlug: string,
    filter?: ListTokensFilter,
  ): Promise<ListTokensPage> {
    let cursor: string | undefined;
    const collected: Token[] = [];
    const want = filter?.limit ?? 60;
    const wantListedOnly = filter?.listedOnly ?? true;
    try {
      for (let i = 0; i < 4 && collected.length < want; i++) {
        const page = await this.client.getCollectionListings({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          cursor,
          limit: 50,
        });
        for (const order of page.listings) {
          if (!order.token_id) continue;
          const tokenId = String(order.token_id);
          const token = orderToListedToken(order, chainSlug);
          collected.push(token);
          this.tokens.set(tokenId, { value: token, fetchedAt: Date.now() });
        }
        if (!page.next || page.listings.length === 0) break;
        cursor = String(page.next);
      }
    } catch {
      // Fail closed: return whatever we collected.
    }
    let tokens = collected;
    if (filter?.category) {
      tokens = tokens.filter((t) => t.traits.some((tr) => tr.slug === filter.category));
    }
    if (!wantListedOnly) {
      // No-op; listings are inherently listed. The caller is asking for
      // all currently-listed tokens.
    }
    return { tokens: tokens.slice(0, want), total: tokens.length };
  }

  async getCollectionSnapshot(): Promise<CollectionSnapshot> {
    if (isFresh(this.collectionCache)) return this.collectionCache.value;
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
      floorPriceEth: null,
      volume24hEth: 0,
      volume7dEth: 0,
      sales24h: 0,
      sales7d: 0,
      topSalePriceEth: null,
      topOfferPriceEth: null,
      refreshedAt: Date.now(),
    };
    if (!chain) {
      this.collectionCache = { value: fallback, fetchedAt: Date.now() };
      return fallback;
    }
    try {
      const listingsPage = await this.client.getCollectionListings({
        slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
        limit: 200,
      });
      const prices = listingsPage.listings
        .map((o) => decimalPriceEth(o))
        .filter((n): n is number => n !== null);
      const floor = prices.length > 0 ? Math.min(...prices) : null;
      const listed = listingsPage.listings.length;
      this.collectionCache = {
        value: {
          ...fallback,
          listedCount: listed,
          floorPriceEth: floor,
        },
        fetchedAt: Date.now(),
      };
      return this.collectionCache.value;
    } catch {
      this.collectionCache = { value: fallback, fetchedAt: Date.now() };
      return fallback;
    }
  }

  async getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
    const cached = this.categories.get(slug);
    if (isFresh(cached)) return cached.value;
    const snapshot = await this.getCollectionSnapshot();
    // Without per-token ownership and historical sales in the indexer,
    // we can only compute category analytics from the listings we have
    // and from per-NFT metadata. This is intentionally a minimal P0
    // implementation; P5 will add per-token sale history persistence.
    const tokens = await this.listTokens({ listedOnly: true, limit: 200 });
    const members = tokens.tokens.filter((t) => t.traits.some((tr) => tr.slug === slug));
    const listed = members.filter((t) => t.listingPriceEth !== null);
    const floors = listed
      .map((t) => (t.listingPriceEth ? Number.parseFloat(t.listingPriceEth) : null))
      .filter((n): n is number => n !== null);
    const floor = floors.length > 0 ? Math.min(...floors) : null;
    const lastSales = members
      .map((t) => (t.lastSalePriceEth ? Number.parseFloat(t.lastSalePriceEth) : null))
      .filter((n): n is number => n !== null);
    const lastSale = lastSales.length > 0 ? lastSales[lastSales.length - 1] ?? null : null;
    const owners = new Set(
      members.map((t) => (t.ownerAddress ?? '').toLowerCase()).filter(Boolean),
    ).size;
    const metrics: CategoryMetrics = {
      slug,
      name: slug,
      family: 'unknown',
      description: '',
      memberSupply: members.length,
      totalSupply: snapshot.totalSupply,
      listedCount: listed.length,
      owners,
      floorPriceEth: floor,
      lastSalePriceEth: lastSale,
      topOfferPriceEth: snapshot.topOfferPriceEth,
      topSalePriceEth: snapshot.topSalePriceEth,
      volume24hEth: 0,
      volume7dEth: 0,
      sales24h: 0,
      sales7d: 0,
    };
    this.categories.set(slug, { value: metrics, fetchedAt: Date.now() });
    return metrics;
  }

  async listCategories(): Promise<CategoryMetrics[]> {
    const snapshot = await this.getCollectionSnapshot();
    const page = await this.listTokens({ listedOnly: true, limit: 200 });
    // Group listed tokens by their virtual-collection slugs.
    const bySlug = new Map<string, { count: number; floors: number[]; owners: Set<string> }>();
    for (const t of page.tokens) {
      const tokenFloor = t.listingPriceEth ? Number.parseFloat(t.listingPriceEth) : null;
      for (const tr of t.traits) {
        if (tr.family === 'digits' && !tr.slug.startsWith('digits-')) continue;
        const entry = bySlug.get(tr.slug) ?? { count: 0, floors: [], owners: new Set() };
        entry.count += 1;
        if (tokenFloor !== null) entry.floors.push(tokenFloor);
        if (t.ownerAddress) entry.owners.add(t.ownerAddress.toLowerCase());
        bySlug.set(tr.slug, entry);
      }
    }
    const out: CategoryMetrics[] = [];
    for (const [slug, agg] of bySlug.entries()) {
      const floor = agg.floors.length > 0 ? Math.min(...agg.floors) : null;
      out.push({
        slug,
        name: slug,
        family: 'unknown',
        description: '',
        memberSupply: agg.count,
        totalSupply: snapshot.totalSupply,
        listedCount: agg.count,
        owners: agg.owners.size,
        floorPriceEth: floor,
        lastSalePriceEth: null,
        topOfferPriceEth: snapshot.topOfferPriceEth,
        topSalePriceEth: snapshot.topSalePriceEth,
        volume24hEth: 0,
        volume7dEth: 0,
        sales24h: 0,
        sales7d: 0,
      });
    }
    return out;
  }

  async listRecentSales(_limit = 20): Promise<Sale[]> {
    // P0: not implemented. We have no sale history yet; the indexer
    // adds this in a later slice. Returning an empty array keeps the
    // UI honest.
    return [];
  }

  async listRecentOffers(_limit = 20): Promise<Offer[]> {
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

  async getFreshness(): Promise<DataFreshness> {
    await this.ensureChain();
    const refreshedAt = this.collectionCache?.fetchedAt ?? null;
    const fresh =
      this.resolvedChain !== undefined &&
      refreshedAt !== null &&
      Date.now() - refreshedAt < TTL_MS;
    return {
      fresh: Boolean(fresh),
      refreshedAt,
      source: this.resolvedChain ? 'opensea' : 'fixture',
      resolvedChainSlug: this.resolvedChain?.chain ?? null,
    };
  }
}

function nftToToken(tokenId: string, nft: NftInfo): Token {
  const classification = classifyNumber(tokenId);
  const traits: NumberTrait[] = mergeTraits(classification.traits, nft.traits ?? []);
  return {
    tokenId,
    contractAddress:
      nft.contract?.toLowerCase() ?? BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl: nft.image_url ?? nft.image_preview_url ?? buildTokenImageUrl(tokenId),
    name: nft.name ?? `#${tokenId}`,
    listingPriceEth: null,
    lastSalePriceEth: null,
    ownerAddress: nft.owner?.toLowerCase() ?? null,
    traits,
    rarityRank: nft.rarity?.rank ?? null,
    listedAt: null,
    lastSaleAt: null,
  };
}

function mergeTraits(
  base: NumberTrait[],
  openSeaTraits: NonNullable<NftInfo['traits']>,
): NumberTrait[] {
  // OpenSea traits use the trait_type/value pair the project published.
  // Net Vision taxonomy traits are deterministic. We keep the taxonomy
  // traits as the source of truth and let OpenSea values override
  // labels when they exist.
  const byTraitType = new Map<string, string>();
  for (const t of openSeaTraits) {
    if (t.trait_type && t.value !== undefined) {
      byTraitType.set(t.trait_type.toLowerCase(), String(t.value));
    }
  }
  return base.map((trait) => {
    const labelOverride = byTraitType.get(trait.label.toLowerCase());
    if (!labelOverride) return trait;
    return { ...trait, label: labelOverride };
  });
}

function orderToListedToken(order: Order, chainSlug: string): Token {
  const tokenId = String(order.token_id ?? '');
  const classification = classifyNumber(tokenId);
  const price = decimalPriceEth(order);
  return {
    tokenId,
    contractAddress:
      (order.nft_contract ?? BUTTON_PRESSER_COLLECTION.contractAddress).toLowerCase(),
    chainId: ROBINHOOD_CHAIN.id,
    imageUrl: buildTokenImageUrl(tokenId),
    name: order.token_id ? `#${tokenId}` : null,
    listingPriceEth: price === null ? null : price.toFixed(6),
    lastSalePriceEth: null,
    ownerAddress: order.maker.toLowerCase(),
    traits: classification.traits,
    rarityRank: null,
    listedAt: typeof order.valid_from === 'number' ? order.valid_from : null,
    lastSaleAt: null,
  };
  // chainSlug is unused here; it stays on the snapshot for diagnostics.
  void chainSlug;
}

function decimalPriceEth(order: Order): number | null {
  const raw = order.price?.current;
  const decimals = order.price?.decimals;
  if (raw === undefined || decimals === undefined) return null;
  const n = typeof raw === 'string' ? Number.parseFloat(raw) : raw;
  if (!Number.isFinite(n)) return null;
  return n / 10 ** decimals;
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
      floorPriceEth: null,
      volume24hEth: 0,
      volume7dEth: 0,
      sales24h: 0,
      sales7d: 0,
      topSalePriceEth: null,
      topOfferPriceEth: null,
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
  async getFreshness(): Promise<DataFreshness> {
    return {
      fresh: false,
      refreshedAt: null,
      source: 'fixture',
      resolvedChainSlug: null,
    };
  }
  // Expose the failure reason in logs only; not in API responses.
  describeFailure(): string {
    return this.reason;
  }
}

function failingSource(reason: string): MarketSource {
  // Cast is safe; the failing source intentionally exposes a diagnostic
  // helper used by /api/health.
  return new FailingMarketSource(reason) as unknown as MarketSource;
}

export function describeMarketSourceFailure(): string | null {
  return singletonError;
}
