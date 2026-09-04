import { describe, expect, it } from 'vitest';
import {
  CollectionListingsPageSchema,
  OpenSeaClient,
  OpenSeaConfigError,
  OrderSchema,
} from '../src/index';

const BASE_URL = 'https://api.opensea.io';

function makeFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  let i = 0;
  return async (input: RequestInfo | URL): Promise<Response> => {
    const r = responses[i] ?? responses[responses.length - 1];
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
