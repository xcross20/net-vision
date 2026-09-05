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

describe('OrderSchema', () => {
  it('parses a minimal valid order', () => {
    const ok = OrderSchema.safeParse({
      order_hash: '0xabc',
      chain: 'Robinhood',
      protocol: 'seaport',
      protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
      side: 'ask',
      maker: '0x0000000000000000000000000000000000000abc',
      taker: undefined,
      currency: '0x0000000000000000000000000000000000000000',
      price: { current: '1000000000000000', decimals: 18 },
      quantity: 1,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects malformed hex addresses', () => {
    const bad = OrderSchema.safeParse({
      order_hash: '0xabc',
      chain: 'Robinhood',
      protocol: 'seaport',
      protocol_address: 'not-an-address',
      side: 'ask',
      maker: '0x0000000000000000000000000000000000000abc',
      currency: '0x0000000000000000000000000000000000000000',
      price: { current: '1', decimals: 18 },
      quantity: 1,
    });
    expect(bad.success).toBe(false);
  });

  it('rejects unknown side', () => {
    const bad = OrderSchema.safeParse({
      order_hash: '0xabc',
      chain: 'Robinhood',
      protocol: 'seaport',
      protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
      side: 'unknown-side',
      maker: '0x0000000000000000000000000000000000000abc',
      currency: '0x0000000000000000000000000000000000000000',
      price: { current: '1', decimals: 18 },
      quantity: 1,
    });
    expect(bad.success).toBe(false);
  });
});

describe('CollectionListingsPageSchema', () => {
  it('parses a page with listings and cursor', () => {
    const r = CollectionListingsPageSchema.safeParse({
      listings: [],
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
  const order = {
    order_hash: '0xabc',
    chain: 'Robinhood',
    protocol: 'seaport',
    protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
    side: 'ask',
    maker: '0x0000000000000000000000000000000000000abc',
    currency: '0x0000000000000000000000000000000000000000',
    price: { current: '1000000000000000', decimals: 18 },
    quantity: 1,
  };

  it('returns parsed listings on 200', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'Robinhood',
      fetchImpl: makeFetch([{ status: 200, body: { listings: [order], next: null } }]) as typeof fetch,
    });
    const page = await client.getCollectionListings({ slug: 'button-presser' });
    expect(page.listings.length).toBe(1);
    expect(page.listings[0]?.order_hash).toBe('0xabc');
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
        { trait_type: 'Digits', value: '4', rarity: 0.05 },
        { trait_type: 'Type', value: 'Repdigit' },
      ],
      rarity: { rank: 1, score: 9.8, total_supply: 62000 },
      owners: 713,
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
            identifier: '7777',
            contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
            name: '#7777',
            traits: [{ trait_type: 'Digits', value: '4' }],
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
          body: { identifier: '7777', contract: 'not-an-address' },
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
  const order = {
    order_hash: '0xdef',
    chain: 'Robinhood',
    protocol: 'seaport',
    protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
    side: 'ask',
    maker: '0x0000000000000000000000000000000000000abc',
    currency: '0x0000000000000000000000000000000000000000',
    price: { current: '2000000000000000', decimals: 18 },
    quantity: 1,
  };

  it('returns active listings for an account', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([
        { status: 200, body: { listings: [order], next: null } },
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
        { status: 200, body: { listings: [], offers: [order], next: null } },
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
  const order = {
    order_hash: '0xfeed',
    chain: 'Robinhood',
    protocol: 'seaport',
    protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
    side: 'bid',
    maker: '0x0000000000000000000000000000000000000abc',
    currency: '0x0000000000000000000000000000000000000000',
    price: { current: '1500000000000000', decimals: 18 },
    quantity: 1,
  };

  it('returns the best offer for a collection', async () => {
    const client = new OpenSeaClient({
      baseUrl: BASE_URL,
      apiKey: 'test-key',
      chain: 'robinhood',
      fetchImpl: makeFetch([{ status: 200, body: order }]) as typeof fetch,
    });
    const best = await client.getBestOffer({ slug: 'button-presser' });
    expect(best?.order_hash).toBe('0xfeed');
    expect(best?.side).toBe('bid');
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
          body: { fulfillment_data: { transaction: { to: '0x0000000000000068F116a894984e2DB1123eB395' } } },
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
          body: { fulfillment_data: { transaction: { to: '0x0000000000000068F116a894984e2DB1123eB395' } } },
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
