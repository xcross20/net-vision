import { describe, expect, it } from 'vitest';
import {
  ChainInfoSchema,
  CollectionListingsPageSchema,
  NftInfoSchema,
  OpenSeaClient,
  OpenSeaConfigError,
  OpenSeaResponseError,
  OrderSchema,
} from '../src/index';

const BASE_URL = 'https://api.opensea.io';
const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';

function makeFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  let i = 0;
  return async (input: RequestInfo | URL): Promise<Response> => {
    const r = responses[i] ?? responses[responses.length - 1];
    if (!r) throw new Error('no stubbed response');
    i += 1;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
    });
  };
}

/**
 * Build a listing-shaped order for the OpenSea v2 wire format.
 *
 * Listings: `price` is wrapped as `{ current: { currency, decimals, value } }`.
 * Makers/spenders sit at `protocol_data.parameters.offerer`; the target is at
 * `protocol_address`. The `asset` block carries the NFT identifier.
 */
function listingFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    order_hash: '0xabc',
    chain: 'Robinhood',
    protocol_address: SEAPORT,
    protocol_data: {
      parameters: {
        offerer: '0x0000000000000000000000000000000000000abc',
        startTime: '1700000000',
        endTime: '1800000000',
        consideration: [
          {
            itemType: 2,
            identifierOrCriteria: '7777',
            token: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
            startAmount: '1000000000000000',
            endAmount: '1000000000000000',
          },
        ],
      },
    },
    asset: {
      identifier: '7777',
      contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
    },
    remaining_quantity: 1,
    order_created_at: '1700000000',
    price: { current: { currency: 'ETH', decimals: 18, value: '1000000000000000' } },
    type: 'basic',
    status: 'active',
    ...overrides,
  };
}

/**
 * Build an offer-shaped order. Offers use the same envelope as listings but
 * `price` is the flat tuple (no `current` wrapper).
 */
function offerFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    order_hash: '0xfeed',
    chain: 'Robinhood',
    protocol_address: SEAPORT,
    protocol_data: {
      parameters: {
        offerer: '0x0000000000000000000000000000000000000abc',
        startTime: '1700000000',
        endTime: '1800000000',
        consideration: [
          {
            itemType: 2,
            identifierOrCriteria: '0',
            token: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
            startAmount: '1500000000000000',
            endAmount: '1500000000000000',
          },
        ],
      },
    },
    price: { currency: 'ETH', decimals: 18, value: '1500000000000000' },
    type: 'basic',
    status: 'active',
    ...overrides,
  };
}

describe('OrderSchema', () => {
  it('parses a minimal valid listing', () => {
    const ok = OrderSchema.safeParse(listingFixture());
    expect(ok.success).toBe(true);
  });

  it('parses a minimal valid offer', () => {
    const ok = OrderSchema.safeParse(offerFixture());
    expect(ok.success).toBe(true);
  });

  it('rejects malformed protocol_address hex', () => {
    const bad = OrderSchema.safeParse(
      listingFixture({ protocol_address: 'not-an-address' }),
    );
    expect(bad.success).toBe(false);
  });
});

describe('CollectionListingsPageSchema', () => {
  it('parses a page with listings and cursor', () => {
    const r = CollectionListingsPageSchema.safeParse({
      listings: [listingFixture()],
      next: 'cursor-1',
    });
    expect(r.success).toBe(true);
  });
});

describe('OpenSeaClient config', () => {
  it('throws without an API key', () => {
    expect(() => new OpenSeaClient({ baseUrl: BASE_URL, apiKey: '', chain: 'Robinhood' })).toThrow(OpenSeaConfigError);
  });
});

describe('OpenSeaClient getCollectionListings', () => {
  it('returns parsed listings on 200', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'Robinhood',
      fetchImpl: makeFetch([
        { status: 200, body: { listings: [listingFixture()], next: null } },
      ]) as typeof fetch,
    });
    const page = await client.getCollectionListings({ slug: 'button-presser' });
    expect(page.listings.length).toBe(1);
    expect(page.listings[0]?.order_hash).toBe('0xabc');
    expect(page.listings[0]?.price).toMatchObject({
      current: { currency: 'ETH', decimals: 18, value: '1000000000000000' },
    });
  });

  it('fails closed on schema mismatch', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'Robinhood',
      fetchImpl: makeFetch([{ status: 200, body: { listings: 'not-an-array' } }]) as typeof fetch,
    });
    await expect(client.getCollectionListings({ slug: 'button-presser' })).rejects.toThrow();
  });
});

describe('ChainInfoSchema', () => {
  it('parses a minimal chain info record', () => {
    const r = ChainInfoSchema.safeParse({
      chain: 'robinhood',
      chain_id: 1311,
      name: 'Robinhood Chain',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a chain entry without chain_id (name-only fallback path)', () => {
    const r = ChainInfoSchema.safeParse({
      chain: 'robinhood',
      name: 'Robinhood Chain',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain_id).toBeUndefined();
    }
  });
});

describe('NftInfoSchema', () => {
  it('parses an NFT with traits and rarity', () => {
    const r = NftInfoSchema.safeParse({
      identifier: '7777',
      collection: 'button-presser',
      contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
      token_standard: 'erc-721',
      name: '#7777',
      image_url: 'https://i.seadn.io/example/7777.png',
      traits: [
        { trait_type: 'Digits', value: '4' },
        { trait_type: 'Type', value: 'Repdigit' },
      ],
      rarity: { rank: 1, score: 9.8, total_supply: 62000 },
      owners: 713,
    });
    expect(r.success).toBe(true);
  });

  it('accepts owner as a hex string', () => {
    const r = NftInfoSchema.safeParse({
      identifier: '1',
      contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
      owner: '0x0000000000000000000000000000000000000abc',
    });
    expect(r.success).toBe(true);
  });

  it('rejects malformed contract address', () => {
    const r = NftInfoSchema.safeParse({
      identifier: '7777',
      contract: 'not-an-address',
    });
    expect(r.success).toBe(false);
  });
});

describe('OpenSeaClient getChains / resolveChainSlug', () => {
  it('returns the chain matching the Robinhood chain id', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: '',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: {
            chains: [
              { chain: 'ethereum', chain_id: 1, name: 'Ethereum' },
              { chain: 'robinhood', chain_id: 1311, name: 'Robinhood Chain' },
            ],
          },
        },
      ]) as typeof fetch,
    });
    const resolved = await client.resolveChainSlug();
    expect(resolved.chain).toBe('robinhood');
    expect(resolved.chain_id).toBe(1311);
  });

  it('throws when the chain id is not advertised', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: '',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: { chains: [{ chain: 'ethereum', chain_id: 1, name: 'Ethereum' }] },
        },
      ]) as typeof fetch,
    });
    await expect(client.resolveChainSlug()).rejects.toBeInstanceOf(OpenSeaResponseError);
  });

  it('falls back to case-insensitive name match when chain_id is missing', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: '',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: {
            chains: [
              { chain: 'ethereum', name: 'Ethereum' },
              { chain: 'robinhood', name: 'Robinhood Chain' },
            ],
          },
        },
      ]) as typeof fetch,
    });
    const resolved = await client.resolveChainSlug();
    expect(resolved.chain).toBe('robinhood');
    expect(resolved.chain_id).toBeUndefined();
  });
});

describe('OpenSeaClient getNFT', () => {
  it('returns parsed NFT metadata on 200', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: {
            nft: {
              identifier: '7777',
              contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
              name: '#7777',
              traits: [{ trait_type: 'Digits', value: '4' }],
            },
          },
        },
      ]) as typeof fetch,
    });
    const nft = await client.getNFT({
      chain: 'robinhood',
      contractAddress: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
      tokenId: '7777',
    });
    expect(nft.identifier).toBe('7777');
    expect(nft.contract).toBe('0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2');
  });

  it('fails closed on schema mismatch', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: { nft: { identifier: '7777', contract: 'not-an-address' } },
        },
      ]) as typeof fetch,
    });
    await expect(
      client.getNFT({
        chain: 'robinhood',
        contractAddress: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
        tokenId: '7777',
      }),
    ).rejects.toThrow();
  });
});

describe('OpenSeaClient profile endpoints', () => {
  it('returns active listings for an account', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        { status: 200, body: { listings: [listingFixture({ order_hash: '0xdef' })], next: null } },
      ]) as typeof fetch,
    });
    const listings = await client.getProfileListings({ address: '0xabc' });
    expect(listings.length).toBe(1);
    expect(listings[0]?.order_hash).toBe('0xdef');
  });

  it('returns offers for an account when present', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: { listings: [], offers: [offerFixture({ order_hash: '0xdef' })], next: null },
        },
      ]) as typeof fetch,
    });
    const offers = await client.getAccountOffers({ address: '0xabc' });
    expect(offers.length).toBe(1);
    expect(offers[0]?.order_hash).toBe('0xdef');
  });

  it('returns an empty array when the account has no offers', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        { status: 200, body: { listings: [], next: null } },
      ]) as typeof fetch,
    });
    const offers = await client.getAccountOffers({ address: '0xabc' });
    expect(offers).toEqual([]);
  });
});

describe('OpenSeaClient getBestOffer', () => {
  it('returns the best offer for a collection', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([{ status: 200, body: offerFixture() }]) as typeof fetch,
    });
    const best = await client.getBestOffer({ slug: 'button-presser' });
    expect(best?.order_hash).toBe('0xfeed');
  });

  it('returns null when no offer exists', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([{ status: 200, body: null }]) as typeof fetch,
    });
    expect(await client.getBestOffer({ slug: 'button-presser' })).toBeNull();
  });
});

describe('OpenSeaClient fulfillment endpoints', () => {
  it('returns raw fulfillment data for a listing', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: { fulfillment_data: { transaction: { to: SEAPORT } } },
        },
      ]) as typeof fetch,
    });
    const fd = await client.getListingFulfillmentData({
      orderHash: '0xabc',
      fulfillerAddress: '0x0000000000000000000000000000000000000abc',
      chain: 'robinhood',
    });
    expect(fd.raw).toBeDefined();
  });

  it('returns raw fulfillment data for an offer', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: { fulfillment_data: { transaction: { to: SEAPORT } } },
        },
      ]) as typeof fetch,
    });
    const fd = await client.getOfferFulfillmentData({
      orderHash: '0xabc',
      fulfillerAddress: '0x0000000000000000000000000000000000000abc',
      chain: 'robinhood',
    });
    expect(fd.raw).toBeDefined();
  });

  it('does not retry a 5xx response on write endpoints', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([{ status: 500, body: { error: 'down' } }]) as typeof fetch,
    });
    await expect(
      client.getListingFulfillmentData({
        orderHash: '0xabc',
        fulfillerAddress: '0x0000000000000000000000000000000000000abc',
        chain: 'robinhood',
      }),
    ).rejects.toThrow();
  });
});

describe('OpenSeaClient getBestListing', () => {
  it('returns null on 404 so callers can treat the token as unlisted', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([{ status: 404, body: { error: 'not found' } }]) as typeof fetch,
    });
    expect(await client.getBestListing({ slug: 'button-presser', tokenId: '628' })).toBeNull();
  });
});

describe('OpenSeaClient events and nft offers', () => {
  it('parses collection sale events', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        {
          status: 200,
          body: {
            asset_events: [
              {
                event_type: 'sale',
                event_timestamp: 1_800_000_000,
                order_hash: '0xsale',
                seller: '0x0000000000000000000000000000000000000aaa',
                buyer: '0x0000000000000000000000000000000000000bbb',
                payment: { quantity: '560000000', decimals: 6, symbol: 'USDG' },
                nft: { identifier: '628', contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2' },
              },
            ],
            next: null,
          },
        },
      ]) as typeof fetch,
    });
    const page = await client.getCollectionEvents({
      slug: 'button-presser',
      eventType: 'sale',
      limit: 20,
    });
    expect(page.asset_events?.[0]?.nft?.identifier).toBe('628');
    expect(page.asset_events?.[0]?.payment?.symbol).toBe('USDG');
  });

  it('returns nft offers and treats 404 as empty', async () => {
    const withOffers = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        { status: 200, body: { offers: [offerFixture({ order_hash: '0xoff' })] } },
      ]) as typeof fetch,
    });
    const offers = await withOffers.getNftOffers({ slug: 'button-presser', tokenId: '25' });
    expect(offers[0]?.order_hash).toBe('0xoff');

    const missing = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([{ status: 404, body: { error: 'not found' } }]) as typeof fetch,
    });
    expect(await missing.getNftOffers({ slug: 'button-presser', tokenId: '25' })).toEqual([]);
  });
});
