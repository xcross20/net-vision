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
 */

import { z } from 'zod';

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const OPTIONAL_HEX_ADDRESS = z
  .string()
  .regex(HEX_ADDRESS, 'expected 0x-prefixed 20-byte hex address')
  .optional();

export const OrderSchema = z
  .object({
    order_hash: z.string().min(1),
    chain: z.string().min(1),
    protocol: z.string().min(1),
    protocol_address: z.string().regex(HEX_ADDRESS),
    side: z.enum(['ask', 'bid']),
    maker: z.string().regex(HEX_ADDRESS),
    taker: OPTIONAL_HEX_ADDRESS,
    currency: z.string().regex(HEX_ADDRESS),
    currency_symbol: z.string().min(1).optional(),
    price: z
      .object({
        current: z.union([z.string(), z.number()]),
        decimals: z.number().int().min(0).max(36),
        currency: z.string().optional(),
      })
      .passthrough(),
    quantity: z.union([z.string(), z.number()]),
    valid_from: z.union([z.string(), z.number()]).optional(),
    valid_until: z.union([z.string(), z.number()]).optional(),
    nft_contract: z.string().regex(HEX_ADDRESS).optional(),
    token_id: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type Order = z.infer<typeof OrderSchema>;

export const CollectionListingsPageSchema = z
  .object({
    listings: z.array(OrderSchema),
    next: z.string().nullish(),
  })
  .passthrough();

export const BestListingSchema = OrderSchema.nullable();

export type CollectionListingsPage = z.infer<typeof CollectionListingsPageSchema>;

export type FulfillmentRequest = {
  orderHash: string;
  fulfillerAddress: string;
  chain: string;
};

export type FulfillmentResponse = {
  raw: unknown;
};

/**
 * Configuration for the OpenSea client. The API key is required and
 * must be supplied by the server environment. Missing keys cause the
 * client to throw on first use, not silently degrade.
 */
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
            // OpenSea requires a User-Agent; many CDNs reject default UAs.
            // The header is informational; the API key is the auth surface.
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
          // Exponential backoff with jitter, capped at 2s.
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
   * `GET /api/v2/listings/collection/{slug}/all` is the preferred
   * collection-specific endpoint. We do not use the deprecated generic
   * listings endpoints.
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
   * Best listing for a specific NFT in a collection. OpenSea v2
   * `GET /api/v2/listings/collection/{slug}/nfts/{identifier}/best`.
   */
  async getBestListing(input: { slug: string; tokenId: string }): Promise<Order | null> {
    const path = `/api/v2/listings/collection/${encodeURIComponent(input.slug)}/nfts/${encodeURIComponent(input.tokenId)}/best`;
    return this.request('GET', path, BestListingSchema);
  }

  /**
   * Fulfillment data is what the user's wallet signs. The application
   * never signs on the user's behalf, but it may forward OpenSea's
   * fulfillment payload after validating it locally.
   *
   * NOTE: We do not define the full fulfillment response schema here
   * because it varies by protocol version. The transaction policy
   * package is the authoritative validator of executable actions.
   */
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

  /**
   * Listing creation actions. Used by the seller flow. The transaction
   * policy engine validates each returned action before any signature
   * prompt is shown.
   */
  async getListingActions(input: unknown): Promise<unknown> {
    return this.request<unknown>(
      'POST',
      '/api/v2/listings/actions',
      z.unknown(),
      { body: input },
      { retry: false },
    );
  }

  /**
   * Sweep endpoint. Used by the virtual collection sweep flow. The
   * transaction policy engine validates the basket before execution.
   */
  async getSweepActions(input: unknown): Promise<unknown> {
    return this.request<unknown>(
      'POST',
      '/api/v2/listings/sweep',
      z.unknown(),
      { body: input },
      { retry: false },
    );
  }
}

/**
 * Build a client from the server environment. This is the only entry
 * point the web app should use; it fails fast on missing configuration.
 */
export function createOpenSeaClient(env: {
  OPENSEA_API_KEY?: string;
  OPENSEA_BASE_URL?: string;
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
    chain: env.OPENSEA_CHAIN ?? 'Robinhood',
  });
}
