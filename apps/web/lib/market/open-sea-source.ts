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
  enumerateAllMembers,
  enumerateMembers,
  isMember,
  type NumberTrait,
  type MemberSet,
} from '@net-vision/taxonomy';
import {
  createOpenSeaClient,
  type ChainInfo,
  type CollectionStats,
  type NftInfo,
  type Order,
  OpenSeaResponseError,
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
const MAX_LISTING_PAGE_COUNT = 4;
const MAX_LISTING_PAGE_SIZE = 200;
const NFT_METADATA_CONCURRENCY = 4;

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
  return err instanceof OpenSeaResponseError && err.status === 404;
}

function normalizeAddress(value: string | undefined | null): string | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value.toLowerCase();
}

function parseEpoch(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

    if (!nft && !listing) return null;
    const listedToken = listing ? orderToListedToken(listing) : null;
    const token = nft ? nftToToken(tokenId, nft) : listedToken;
    let finalToken: Token | null = token;
    if (token && listedToken && nft) {
      finalToken = mergeListedTokenWithNft(listedToken, nft);
    }
    if (finalToken) this.tokens.set(tokenId, { value: finalToken, fetchedAt: Date.now() });
    return finalToken;
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
    _chainSlug: string,
    filter?: ListTokensFilter,
  ): Promise<ListTokensPage> {
    let cursor: string | undefined;
    const orders: Order[] = [];
    const want = Math.min(Math.max(filter?.limit ?? 60, 1), MAX_LISTING_PAGE_SIZE);

    for (let i = 0; i < MAX_LISTING_PAGE_COUNT && orders.length < want; i += 1) {
      const page = await this.client.getCollectionListings({
        slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
        cursor,
        limit: 50,
      });
      for (const order of page.listings) {
        if (!getTokenIdFromOrder(order)) continue;
        orders.push(order);
        if (orders.length >= want) break;
      }
      if (!page.next || page.listings.length === 0) break;
      cursor = String(page.next);
    }

    const listedTokens = await mapWithConcurrency(orders, NFT_METADATA_CONCURRENCY, async (order) => {
      const listedToken = orderToListedToken(order);
      if (!listedToken) return null;
      const nft = await this.fetchNFT(listedToken.tokenId);
      const token = nft ? mergeListedTokenWithNft(listedToken, nft) : listedToken;
      this.tokens.set(token.tokenId, { value: token, fetchedAt: Date.now() });
      return token;
    });
    const tokens = listedTokens.filter((token): token is Token => token !== null);
    const filteredTokens = tokens.filter((token) => matchesCategoryFilter(token, filter));
    return { tokens: filteredTokens.slice(0, want), total: filteredTokens.length };
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

    const [statsResult, listingsResult] = await Promise.allSettled([
      this.client.getCollectionStats({ slug: BUTTON_PRESSER_COLLECTION.openseaSlug }),
      this.client.getCollectionListings({
        slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
        limit: MAX_LISTING_PAGE_SIZE,
      }),
    ]);
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : undefined;
    const listings = listingsResult.status === 'fulfilled' ? listingsResult.value : undefined;
    if (!stats) {
      console.error(`OpenSea collection stats failed: ${statsResult.status === 'rejected' ? String(statsResult.reason) : 'unknown error'}`);
    }
    if (!listings) {
      console.error(`OpenSea collection listings failed: ${listingsResult.status === 'rejected' ? String(listingsResult.reason) : 'unknown error'}`);
    }

    const oneDay = stats?.intervals?.find((interval) => interval.interval === 'one_day');
    const sevenDays = stats?.intervals?.find((interval) => interval.interval === 'seven_day');
    const snapshot: CollectionSnapshot = {
      ...fallback,
      totalSupply: stats?.total.total_supply ?? stats?.total.num_items ?? 0,
      owners: stats?.total.num_owners ?? 0,
      listedCount: listings?.listings.length ?? 0,
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

  async getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
    const cached = this.categories.get(slug);
    if (isFresh(cached)) return cached.value;
    const snapshot = await this.getCollectionSnapshot();
    const tokens = await this.listTokens({ listedOnly: true, limit: MAX_LISTING_PAGE_SIZE });
    const members = this.membersFor(slug);
    const memberIdSet = new Set(members.members);
    const memberTokens = tokens.tokens.filter((token) => memberIdSet.has(token.tokenId));
    const listed = memberTokens.filter((token) => token.listingPrice !== null);
    const floors = listed
      .map((token) => token.listingPrice)
      .filter((price): price is number => price !== null);
    const floor = floors.length > 0 ? Math.min(...floors) : null;
    const owners = new Set(
      memberTokens
        .map((token) => token.ownerAddress?.toLowerCase() ?? '')
        .filter(Boolean),
    ).size;
    const subFilter =
      slug === 'palindrome' && members.byDigitCount
        ? buildPalindromeFacets(members, listed)
        : undefined;
    const metrics: CategoryMetrics = {
      slug,
      name: slug,
      family: 'unknown',
      description: '',
      memberSupply: members.count,
      filteredMemberSupply: members.count,
      totalSupply: snapshot.totalSupply,
      listedCount: listed.length,
      owners,
      currency: snapshot.currency,
      floorPrice: floor,
      lastSalePrice: null,
      topOfferPrice: null,
      topSalePrice: null,
      volume24hNative: 0,
      volume7dNative: 0,
      sales24h: 0,
      sales7d: 0,
      subFilter,
    };
    this.categories.set(slug, { value: metrics, fetchedAt: Date.now() });
    return metrics;
  }

  async listCategories(): Promise<CategoryMetrics[]> {
    const snapshot = await this.getCollectionSnapshot();
    const page = await this.listTokens({ listedOnly: true, limit: MAX_LISTING_PAGE_SIZE });
    const bySlug = new Map<string, { count: number; floors: number[]; owners: Set<string> }>();
    for (const token of page.tokens) {
      for (const trait of token.traits) {
        if (trait.family === 'digits' && !trait.slug.startsWith('digits-')) continue;
        const entry = bySlug.get(trait.slug) ?? { count: 0, floors: [], owners: new Set() };
        entry.count += 1;
        if (token.listingPrice !== null) entry.floors.push(token.listingPrice);
        if (token.ownerAddress) entry.owners.add(token.ownerAddress.toLowerCase());
        bySlug.set(trait.slug, entry);
      }
    }
    const supplyRange = {
      minTokenId: BUTTON_PRESSER_COLLECTION.minTokenId,
      maxTokenId: BUTTON_PRESSER_COLLECTION.maxTokenId,
    };
    const allMembers = new Map(
      Object.entries(enumerateAllMembers(supplyRange)),
    );
    return [...allMembers.entries()]
      .filter(([slug]) => bySlug.has(slug))
      .map(([slug, members]) => {
        const aggregate = bySlug.get(slug)!;
        return {
          slug,
          name: slug,
          family: 'unknown',
          description: '',
          memberSupply: members.count,
          filteredMemberSupply: members.count,
          totalSupply: snapshot.totalSupply,
          listedCount: aggregate.count,
          owners: aggregate.owners.size,
          currency: snapshot.currency,
          floorPrice: aggregate.floors.length > 0 ? Math.min(...aggregate.floors) : null,
          lastSalePrice: null,
          topOfferPrice: null,
          topSalePrice: null,
          volume24hNative: 0,
          volume7dNative: 0,
          sales24h: 0,
          sales7d: 0,
        };
      });
  }

  async listRecentSales(_limit = 20): Promise<Sale[]> {
    return [];
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
    const page = await this.client.getCollectionOffers({
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      limit: MAX_LISTING_PAGE_SIZE,
    });
    const offers = page.offers
      .map(orderToOffer)
      .filter((offer): offer is Offer => offer !== null)
      .filter((offer) => offer.tokenId === tokenId)
      .sort((a, b) => b.price - a.price);
    this.tokenOffers.set(tokenId, { value: offers, fetchedAt: Date.now() });
    return offers;
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
  const byTraitType = new Map<string, string>();
  for (const trait of openSeaTraits) {
    if (trait.trait_type && trait.value !== undefined) {
      byTraitType.set(trait.trait_type.toLowerCase(), String(trait.value));
    }
  }
  return base.map((trait) => {
    const labelOverride = byTraitType.get(trait.label.toLowerCase());
    if (!labelOverride) return trait;
    return { ...trait, label: labelOverride };
  });
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
