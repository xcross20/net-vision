/**
 * Net Vision OpenSea read gateway.
 *
 * All OpenSea API credentials stay server-side. The web app must call
 * Net Vision endpoints, never OpenSea directly, and the OpenSea API key
 * is never bundled into the browser. This gateway is the only place in
 * the application that touches OpenSea.
 *
 * Every response is validated against a Zod schema. Unknown fields are
 * tolerated so upstream additions don't break us, but missing required
 * security-sensitive fields cause a hard failure.
 *
 * SCHEMA SHAPE: This file models the actual OpenSea v2 response. Earlier
 * revisions invented a flat shape that doesn't match the real API; every
 * response was silently dropped by the `safeParse` filter in the source.
 * If OpenSea ever changes the wire format, update the schemas here and
 * add a fixture to tests/opensea-client.test.ts before touching callers.
 */

import { z } from 'zod';

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const OPTIONAL_HEX_ADDRESS = z
  .string()
  .regex(HEX_ADDRESS, 'expected 0x-prefixed 20-byte hex address')
  .optional();

/* -------------------------------------------------------------------------- */
/*  Price envelope                                                             */
/* -------------------------------------------------------------------------- */

/**
 * OpenSea represents prices as a `{ currency, decimals, value }` tuple
 * where `value` is a decimal-string of the smallest unit (wei for ETH,
 * 6-decimal subunits for USDG). Listings nest this under `price.current`;
 * offers keep it flat at `price`.
 */
const PriceTupleSchema = z
  .object({
    currency: z.string().min(1),
    decimals: z.number().int().min(0).max(36),
    value: z.union([z.string(), z.number()]),
  })
  .passthrough();

/**
 * The actual response is one of two shapes:
 *   - listings: { price: { current: <tuple> } }
 *   - offers:   { price: <tuple> }
 * We accept either.
 */
const PriceEnvelopeSchema = z
  .object({
    current: PriceTupleSchema.optional(),
  })
  .passthrough()
  .refine(
    (p) =>
      PriceTupleSchema.safeParse(p).success ||
      PriceTupleSchema.safeParse((p as { current?: unknown }).current).success,
    'price envelope must contain either a tuple at price or a tuple at price.current',
  );

/* -------------------------------------------------------------------------- */
/*  Order (listings + offers share this shape)                                */
/* -------------------------------------------------------------------------- */

export const OrderSchema = z
  .object({
    order_hash: z.string().min(1),
    chain: z.string().min(1),
    protocol_data: z
      .object({
        parameters: z
          .object({
            offerer: z.string().regex(HEX_ADDRESS).optional(),
            startTime: z.union([z.string(), z.number()]).optional(),
            endTime: z.union([z.string(), z.number()]).optional(),
            offer: z
              .array(
                z
                  .object({
                    itemType: z.number().int(),
                    identifierOrCriteria: z.union([z.string(), z.number()]).optional(),
                    token: z.string().regex(HEX_ADDRESS).optional(),
                    startAmount: z.union([z.string(), z.number()]).optional(),
                    endAmount: z.union([z.string(), z.number()]).optional(),
                    recipient: z.string().regex(HEX_ADDRESS).optional(),
                  })
                  .passthrough(),
              )
              .optional(),
            consideration: z
              .array(
                z
                  .object({
                    itemType: z.number().int(),
                    identifierOrCriteria: z.union([z.string(), z.number()]).optional(),
                    token: z.string().regex(HEX_ADDRESS).optional(),
                    startAmount: z.union([z.string(), z.number()]).optional(),
                    endAmount: z.union([z.string(), z.number()]).optional(),
                    recipient: z.string().regex(HEX_ADDRESS).optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      })
      .passthrough(),
    protocol_address: z.string().regex(HEX_ADDRESS),
    /**
     * The NFT being traded. For listings, this is the listed asset; for
     * collection-level offer endpoints the OpenSea API still surfaces a
     * single `asset` block per order in the response.
     */
    asset: z
      .object({
        identifier: z.union([z.string(), z.number()]),
        contract: z.string().regex(HEX_ADDRESS),
      })
      .passthrough()
      .optional(),
    remaining_quantity: z.number().int().nonnegative().optional(),
    order_created_at: z.union([z.string(), z.number()]).optional(),
    price: PriceEnvelopeSchema,
    /**
     * `type` discriminates listings (`basic`) from offers; kept as a free
     * string so OpenSea can add new order kinds without breaking us.
     */
    type: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export type Order = z.infer<typeof OrderSchema>;

/* -------------------------------------------------------------------------- */
/*  Pages                                                                      */
/* -------------------------------------------------------------------------- */

export const CollectionListingsPageSchema = z
  .object({
    listings: z.array(OrderSchema),
    next: z.string().nullish(),
  })
  .passthrough();

export const CollectionOffersPageSchema = z
  .object({
    offers: z.array(OrderSchema),
    next: z.string().nullish(),
  })
  .passthrough();

export const BestListingSchema = OrderSchema.nullable();

export const BestOfferSchema = OrderSchema.nullable();

export const NftOffersPageSchema = z
  .object({
    offers: z.array(OrderSchema).optional(),
    listings: z.array(OrderSchema).optional(),
    next: z.string().nullish(),
  })
  .passthrough();

export type NftOffersPage = z.infer<typeof NftOffersPageSchema>;

/* -------------------------------------------------------------------------- */
/*  Events                                                                     */
/* -------------------------------------------------------------------------- */

const EventPaymentSchema = z
  .object({
    quantity: z.union([z.string(), z.number()]).optional(),
    decimals: z.number().int().min(0).max(36).optional(),
    symbol: z.string().optional(),
    token_address: z.string().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const EventNftSchema = z
  .object({
    identifier: z.union([z.string(), z.number()]).optional(),
    contract: z.string().optional(),
    collection: z.string().optional(),
    name: z.string().optional(),
    image_url: z.string().optional(),
  })
  .passthrough();

const AddressLikeSchema = z.union([
  z.string(),
  z
    .object({
      address: z.string().optional(),
    })
    .passthrough(),
]);

export const AssetEventSchema = z
  .object({
    event_type: z.string().optional(),
    order_type: z.string().optional(),
    event_timestamp: z.union([z.number(), z.string()]).optional(),
    closing_date: z.union([z.number(), z.string()]).optional(),
    order_hash: z.string().nullish(),
    transaction: z
      .union([
        z.string(),
        z
          .object({
            hash: z.string().optional(),
          })
          .passthrough(),
      ])
      .optional(),
    seller: AddressLikeSchema.optional(),
    buyer: AddressLikeSchema.optional(),
    from_address: z.string().optional(),
    to_address: z.string().optional(),
    payment: EventPaymentSchema.optional(),
    nft: EventNftSchema.optional(),
    asset: EventNftSchema.optional(),
  })
  .passthrough();

export const CollectionEventsPageSchema = z
  .object({
    asset_events: z.array(AssetEventSchema).optional(),
    events: z.array(AssetEventSchema).optional(),
    next: z.string().nullish(),
  })
  .passthrough();

export type AssetEvent = z.infer<typeof AssetEventSchema>;
export type CollectionEventsPage = z.infer<typeof CollectionEventsPageSchema>;

export type CollectionListingsPage = z.infer<typeof CollectionListingsPageSchema>;
export type CollectionOffersPage = z.infer<typeof CollectionOffersPageSchema>;

/* -------------------------------------------------------------------------- */
/*  NFT metadata                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors `/api/v2/chain/{chain}/contract/{contract}/nfts/{tokenId}`.
 * The actual response wraps everything under `nft`; callers unwrap that.
 */
export const NftInfoSchema = z
  .object({
    identifier: z.union([z.string(), z.number()]),
    collection: z.string().optional(),
    contract: z.string().regex(HEX_ADDRESS).optional(),
    token_standard: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    image_url: z.string().url().optional(),
    display_image_url: z.string().url().optional(),
    image_preview_url: z.string().url().optional(),
    image_original_url: z.string().url().optional(),
    animation_url: z.string().url().nullable().optional(),
    opensea_url: z.string().url().optional(),
    owner: z.string().regex(HEX_ADDRESS).optional(),
    updated_at: z.string().optional(),
    total_supply: z.number().int().nonnegative().optional(),
    traits: z
      .array(
        z
          .object({
            trait_type: z.string().optional(),
            value: z.union([z.string(), z.number()]).optional(),
            display_type: z.string().nullable().optional(),
            max_value: z.union([z.string(), z.number()]).nullable().optional(),
          })
          .passthrough(),
      )
      .optional(),
    rarity: z
      .object({
        rank: z.number().optional(),
        score: z.number().optional(),
        total_supply: z.number().optional(),
      })
      .passthrough()
      .optional(),
    owners: z
      .union([
        z.number().int().nonnegative(),
        z.array(
          z.union([
            z.string().regex(HEX_ADDRESS),
            z
              .object({
                address: z.string().regex(HEX_ADDRESS),
                quantity: z.number().optional(),
                quantity_string: z.string().optional(),
              })
              .passthrough(),
          ]),
        ),
      ])
      .optional(),
  })
  .passthrough();

export type NftInfo = z.infer<typeof NftInfoSchema>;

export const NftResponseSchema = z
  .object({
    nft: NftInfoSchema,
  })
  .passthrough();

export const AccountNftsPageSchema = z
  .object({
    nfts: z.array(NftInfoSchema),
    next: z.string().nullish(),
  })
  .passthrough();

export type AccountNftsPage = z.infer<typeof AccountNftsPageSchema>;

/* -------------------------------------------------------------------------- */
/*  Collection stats                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `/api/v2/collections/{slug}/stats`. Two distinct currencies appear in the
 * same response:
 *   - total.volume / intervals[].volume are denominated in chain-native (ETH)
 *   - total.floor_price is denominated in the collection's payment currency
 *     (USDG on Robinhood Chain Button Presser)
 */
export const CollectionStatsSchema = z
  .object({
    total: z
      .object({
        volume: z.number().nullable().optional(),
        volume_symbol: z.string().optional(),
        sales: z.number().int().nonnegative().optional(),
        num_owners: z.number().int().nonnegative().optional(),
        total_supply: z.number().int().nonnegative().nullable().optional(),
        num_items: z.number().int().nonnegative().nullable().optional(),
        floor_price: z.number().nullable().optional(),
        floor_price_symbol: z.string().optional(),
        market_cap: z.number().nullable().optional(),
      })
      .passthrough(),
    intervals: z
      .array(
        z
          .object({
            interval: z.string(),
            volume: z.number().nullable().optional(),
            volume_symbol: z.string().optional(),
            sales: z.number().int().nonnegative().optional(),
            average_price: z.number().nullable().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export type CollectionStats = z.infer<typeof CollectionStatsSchema>;

/* -------------------------------------------------------------------------- */
/*  Fulfillment / actions (still loosely validated)                           */
/* -------------------------------------------------------------------------- */

export type FulfillmentRequest = {
  orderHash: string;
  fulfillerAddress: string;
  chain: string;
};

export type FulfillmentResponse = {
  raw: unknown;
};

/* -------------------------------------------------------------------------- */
/*  Chain discovery                                                            */
/* -------------------------------------------------------------------------- */

export const ChainInfoSchema = z
  .object({
    chain: z.string().min(1),
    /**
     * Numeric EVM chain id. Optional because OpenSea has shipped
     * responses without this field; we fall back to name matching in
     * {@link OpenSeaClient.resolveChainSlug}.
     */
    chain_id: z.number().int().optional(),
    name: z.string().min(1),
    native_currency: z.string().optional(),
    symbol: z.string().optional(),
    block_explorer: z.string().optional(),
    block_explorer_url: z.string().optional(),
    erc20_tokens: z.array(z.string()).optional(),
    opensea_verified_at: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type ChainInfo = z.infer<typeof ChainInfoSchema>;

const ProfileListingsResponseSchema = z
  .object({
    listings: z.array(OrderSchema),
    offers: z.array(OrderSchema).optional(),
    next: z.string().nullish(),
  })
  .passthrough();

/* -------------------------------------------------------------------------- */
/*  Config + errors                                                            */
/* -------------------------------------------------------------------------- */

export type OpenSeaClientConfig = {
  baseUrl: string;
  apiKey: string;
  chain: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class OpenSeaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenSeaConfigError';
  }
}

/* -------------------------------------------------------------------------- */
/*  Client                                                                     */
/* -------------------------------------------------------------------------- */

export class OpenSeaResponseError extends Error {
  readonly status: number;
  readonly requestId?: string;
  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'OpenSeaResponseError';
    this.status = status;
    this.requestId = requestId;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`request timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class OpenSeaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly chain: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: OpenSeaClientConfig) {
    if (!config.apiKey) {
      throw new OpenSeaConfigError('OpenSea API key is required (server-side only)');
    }
    if (!config.baseUrl) {
      throw new OpenSeaConfigError('OpenSea base URL is required');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.chain = config.chain;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 8_000;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    schema: z.ZodType<T>,
    init?: { body?: unknown; query?: Record<string, string | number | undefined> },
    options: { retry?: boolean } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-api-key': this.apiKey,
      'x-net-vision-client': 'net-vision/0.1',
    };
    const body = init?.body !== undefined ? JSON.stringify(init.body) : undefined;
    if (body) headers['content-type'] = 'application/json';

    let attempt = 0;
    let lastError: unknown;
    const maxAttempts = options.retry === false ? 1 : 3;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const res = await withTimeout(
          this.fetchImpl(url.toString(), {
            method,
            headers,
            body,
          }),
          this.timeoutMs,
        );

        if (!res.ok) {
          const retryable = isRetryableStatus(res.status);
          if (!retryable || attempt >= maxAttempts) {
            throw new OpenSeaResponseError(
              `OpenSea ${method} ${path} failed: ${res.status} ${res.statusText}`,
              res.status,
              res.headers.get('x-request-id') ?? undefined,
            );
          }
          const delay = Math.min(2_000, 100 * 2 ** (attempt - 1)) + Math.random() * 50;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        const json: unknown = await res.json();
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new OpenSeaResponseError(
            `OpenSea response schema mismatch on ${method} ${path}: ${parsed.error.message}`,
            res.status,
            res.headers.get('x-request-id') ?? undefined,
          );
        }
        return parsed.data;
      } catch (err) {
        lastError = err;
        if (err instanceof OpenSeaResponseError && !isRetryableStatus(err.status)) {
          throw err;
        }
        if (attempt >= maxAttempts) {
          throw err;
        }
        const delay = Math.min(2_000, 100 * 2 ** (attempt - 1)) + Math.random() * 50;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('OpenSea request failed');
  }

  /**
   * Page through listings for a collection. OpenSea v2
   * `GET /api/v2/listings/collection/{slug}/all`.
   */
  async getCollectionListings(input: {
    slug: string;
    cursor?: string;
    limit?: number;
  }): Promise<CollectionListingsPage> {
    return this.request(
      'GET',
      `/api/v2/listings/collection/${encodeURIComponent(input.slug)}/all`,
      CollectionListingsPageSchema,
      { query: { cursor: input.cursor, limit: input.limit } },
    );
  }

  /**
   * Cheapest active listings for a collection (price-ascending).
   * OpenSea v2 `GET /api/v2/listings/collection/{slug}/best`.
   * Prefer this over `/all` when hydrating floors — `/all` is not
   * reliably price-sorted on Robinhood.
   */
  async getCollectionBestListings(input: {
    slug: string;
    cursor?: string;
    limit?: number;
  }): Promise<CollectionListingsPage> {
    return this.request(
      'GET',
      `/api/v2/listings/collection/${encodeURIComponent(input.slug)}/best`,
      CollectionListingsPageSchema,
      { query: { cursor: input.cursor, limit: input.limit } },
    );
  }

  /**
   * Page through collection-wide offers (bids on any token in the
   * collection). OpenSea v2 `GET /api/v2/offers/collection/{slug}/all`.
   */
  async getCollectionOffers(input: {
    slug: string;
    cursor?: string;
    limit?: number;
  }): Promise<CollectionOffersPage> {
    return this.request(
      'GET',
      `/api/v2/offers/collection/${encodeURIComponent(input.slug)}/all`,
      CollectionOffersPageSchema,
      { query: { cursor: input.cursor, limit: input.limit } },
    );
  }

  /**
   * Best listing for a specific NFT in a collection. OpenSea v2
   * `GET /api/v2/listings/collection/{slug}/nfts/{identifier}/best`.
   */
  async getBestListing(input: { slug: string; tokenId: string }): Promise<Order | null> {
    const path = `/api/v2/listings/collection/${encodeURIComponent(input.slug)}/nfts/${encodeURIComponent(input.tokenId)}/best`;
    try {
      return await this.request('GET', path, BestListingSchema);
    } catch (err) {
      if (err instanceof OpenSeaResponseError && err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Best item offer for a collection (top bid across all tokens).
   */
  async getBestOffer(input: { slug: string }): Promise<Order | null> {
    const path = `/api/v2/offers/collection/${encodeURIComponent(input.slug)}/best`;
    return this.request('GET', path, BestOfferSchema);
  }

  /**
   * Collection stats. OpenSea v2 `GET /api/v2/collections/{slug}/stats`.
   */
  async getCollectionStats(input: { slug: string }): Promise<CollectionStats> {
    return this.request(
      'GET',
      `/api/v2/collections/${encodeURIComponent(input.slug)}/stats`,
      CollectionStatsSchema,
    );
  }

  async getListingFulfillmentData(input: FulfillmentRequest): Promise<FulfillmentResponse> {
    const raw = await this.request<unknown>(
      'POST',
      '/api/v2/listings/fulfillment_data',
      z.unknown(),
      { body: input },
      { retry: false },
    );
    return { raw };
  }

  async getListingActions(input: unknown): Promise<unknown> {
    return this.request<unknown>(
      'POST',
      '/api/v2/listings/actions',
      z.unknown(),
      { body: input },
      { retry: false },
    );
  }

  async getSweepActions(input: unknown): Promise<unknown> {
    return this.request<unknown>(
      'POST',
      '/api/v2/listings/sweep',
      z.unknown(),
      { body: input },
      { retry: false },
    );
  }

  /**
   * Discover the canonical OpenSea chain identifier for Robinhood Chain.
   */
  async getChains(): Promise<ChainInfo[]> {
    const envelope = await this.request(
      'GET',
      '/api/v2/chains',
      z.object({ chains: z.array(ChainInfoSchema) }).passthrough(),
    );
    return envelope.chains;
  }

  async resolveChainSlug(): Promise<ChainInfo> {
    const chains = await this.getChains();
    const match = chains.find((c) => /robinhood/i.test(c.name));
    if (!match) {
      throw new OpenSeaResponseError(
        `Robinhood Chain not present in /api/v2/chains response`,
        404,
      );
    }
    return match;
  }

  /**
   * Get NFT metadata, traits, ownership, and rarity for a single token.
   * OpenSea v2 `GET /api/v2/chain/{chain}/contract/{contract}/nfts/{tokenId}`.
   * Returns the unwrapped NFT object.
   */
  async getNFT(input: {
    chain: string;
    contractAddress: string;
    tokenId: string;
  }): Promise<NftInfo> {
    const path = `/api/v2/chain/${encodeURIComponent(input.chain)}/contract/${encodeURIComponent(input.contractAddress)}/nfts/${encodeURIComponent(input.tokenId)}`;
    const envelope = await this.request('GET', path, NftResponseSchema);
    return envelope.nft;
  }

  /**
   * NFTs owned by a wallet on a chain.
   * `GET /api/v2/chain/{chain}/account/{address}/nfts`.
   */
  async getAccountNfts(input: {
    chain: string;
    address: string;
    limit?: number;
    next?: string;
    collection?: string;
  }): Promise<AccountNftsPage> {
    const path = `/api/v2/chain/${encodeURIComponent(input.chain)}/account/${encodeURIComponent(input.address)}/nfts`;
    return this.request('GET', path, AccountNftsPageSchema, {
      query: {
        limit: input.limit,
        next: input.next,
        collection: input.collection,
      },
    });
  }

  /**
   * Get active listings for a wallet address.
   */
  async getProfileListings(input: {
    address: string;
    chain?: string;
  }): Promise<Order[]> {
    const path = `/api/v2/account/${encodeURIComponent(input.address)}/listings`;
    const data = await this.request<unknown>(
      'GET',
      path,
      z.unknown(),
      { query: { chain: input.chain } },
    );
    return ProfileListingsResponseSchema.parse(data).listings;
  }

  async getAccountOffers(input: {
    address: string;
    chain?: string;
  }): Promise<Order[]> {
    const path = `/api/v2/account/${encodeURIComponent(input.address)}/offers`;
    const data = await this.request<unknown>(
      'GET',
      path,
      z.unknown(),
      { query: { chain: input.chain } },
    );
    return ProfileListingsResponseSchema.parse(data).offers ?? [];
  }

  async getOfferFulfillmentData(input: FulfillmentRequest): Promise<FulfillmentResponse> {
    const raw = await this.request<unknown>(
      'POST',
      '/api/v2/offers/fulfillment_data',
      z.unknown(),
      { body: input },
      { retry: false },
    );
    return { raw };
  }

  /**
   * Best item offer for a specific NFT.
   * `GET /api/v2/offers/collection/{slug}/nfts/{identifier}/best`.
   */
  async getBestNftOffer(input: { slug: string; tokenId: string }): Promise<Order | null> {
    const path = `/api/v2/offers/collection/${encodeURIComponent(input.slug)}/nfts/${encodeURIComponent(input.tokenId)}/best`;
    try {
      return await this.request('GET', path, BestOfferSchema);
    } catch (err) {
      if (err instanceof OpenSeaResponseError && err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Active item offers for a specific NFT.
   * `GET /api/v2/offers/collection/{slug}/nfts/{identifier}`.
   */
  async getNftOffers(input: { slug: string; tokenId: string; limit?: number }): Promise<Order[]> {
    const path = `/api/v2/offers/collection/${encodeURIComponent(input.slug)}/nfts/${encodeURIComponent(input.tokenId)}`;
    try {
      const page = await this.request('GET', path, NftOffersPageSchema, {
        query: { limit: input.limit },
      });
      return page.offers ?? page.listings ?? [];
    } catch (err) {
      if (err instanceof OpenSeaResponseError && err.status === 404) return [];
      throw err;
    }
  }

  /**
   * Collection activity tape. OpenSea v2
   * `GET /api/v2/events/collection/{slug}`.
   */
  async getCollectionEvents(input: {
    slug: string;
    eventType?: string;
    limit?: number;
    next?: string;
    /** Unix seconds — only events after this timestamp. */
    after?: number;
  }): Promise<CollectionEventsPage> {
    return this.request(
      'GET',
      `/api/v2/events/collection/${encodeURIComponent(input.slug)}`,
      CollectionEventsPageSchema,
      {
        query: {
          event_type: input.eventType,
          limit: input.limit,
          next: input.next,
          after: input.after,
        },
      },
    );
  }

  /**
   * Per-token activity tape. OpenSea v2
   * `GET /api/v2/events/chain/{chain}/contract/{address}/nfts/{tokenId}`.
   */
  async getNftEvents(input: {
    chain: string;
    contractAddress: string;
    tokenId: string;
    eventType?: string;
    limit?: number;
  }): Promise<CollectionEventsPage> {
    const path = `/api/v2/events/chain/${encodeURIComponent(input.chain)}/contract/${encodeURIComponent(input.contractAddress)}/nfts/${encodeURIComponent(input.tokenId)}`;
    return this.request('GET', path, CollectionEventsPageSchema, {
      query: {
        event_type: input.eventType,
        limit: input.limit,
      },
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Factory                                                                    */
/* -------------------------------------------------------------------------- */

const ROBINHOOD_CHAIN_ID = 1311;

/**
 * Build a client from the server environment. This is the only entry
 * point the web app should use; it fails fast on missing configuration.
 *
 * The `OPENSEA_CHAIN` environment variable is treated as a hint only.
 * The authoritative chain slug is discovered via `/api/v2/chains` at
 * server boot.
 */
export function createOpenSeaClient(env: {
  OPENSEA_API_KEY?: string;
  OPENSEA_BASE_URL?: string;
  /** Optional hint; the resolved value is logged at boot. */
  OPENSEA_CHAIN?: string;
}): OpenSeaClient {
  if (!env.OPENSEA_API_KEY) {
    throw new OpenSeaConfigError(
      'OPENSEA_API_KEY is not set; the OpenSea gateway cannot start without a server-side key.',
    );
  }
  return new OpenSeaClient({
    baseUrl: env.OPENSEA_BASE_URL ?? 'https://api.opensea.io',
    apiKey: env.OPENSEA_API_KEY,
    chain: env.OPENSEA_CHAIN ?? '',
  });
}

export { ROBINHOOD_CHAIN_ID };
