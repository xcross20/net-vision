import { describe, expect, it } from 'vitest';
import {
  CollectionListingsPageSchema,
  CollectionStatsSchema,
  OrderSchema,
} from '../src/index';

/**
 * Lock-in tests against the actual shape returned by OpenSea v2 for
 * the Button Presser collection on Robinhood Chain.
 *
 * If OpenSea changes the wire format, these will fail and force the
 * schema to be updated before the live data path silently breaks.
 */
describe('Live OpenSea shape', () => {
  it('parses a real listing from the live API', () => {
    const r = OrderSchema.safeParse({
      order_hash: '0xf08275f3f526aa8f0ca90f69d354498cc95cca41b244ee2ff29f6313f4316dcb',
      chain: 'robinhood',
      protocol_data: {
        parameters: {
          offerer: '0xa9568370b7f9ef732fa2a5a0acdc70d80482a405',
          offer: [
            {
              itemType: 2,
              token: '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2',
              identifierOrCriteria: '52785',
              startAmount: '1',
              endAmount: '1',
            },
          ],
          consideration: [
            {
              itemType: 1,
              token: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
              identifierOrCriteria: '0',
              startAmount: '871200',
              endAmount: '871200',
              recipient: '0xa9568370b7f9ef732fa2a5a0acdc70d80482a405',
            },
          ],
          startTime: '1788550307',
          endTime: '1796326307',
          orderType: 0,
          zone: '0x0000000000000000000000000000000000000000',
        },
      },
      protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
      price: { current: { currency: 'USDG', decimals: 6, value: '880000' } },
    });
    if (!r.success) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(r.error.issues, null, 2));
    }
    expect(r.success).toBe(true);
  });

  it('parses a real listings page from the live API', () => {
    const r = CollectionListingsPageSchema.safeParse({
      listings: [
        {
          order_hash: '0xf08275f3f526aa8f0ca90f69d354498cc95cca41b244ee2ff29f6313f4316dcb',
          chain: 'robinhood',
          protocol_data: {
            parameters: {
              offerer: '0xa9568370b7f9ef732fa2a5a0acdc70d80482a405',
              consideration: [],
              startTime: '1788550307',
              endTime: '1796326307',
            },
          },
          protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
          price: { current: { currency: 'USDG', decimals: 6, value: '880000' } },
        },
      ],
      next: null,
    });
    if (!r.success) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(r.error.issues, null, 2));
    }
    expect(r.success).toBe(true);
  });

  it('parses a real collection stats payload from the live API', () => {
    const r = CollectionStatsSchema.safeParse({
      total: {
        volume: 258.3291054768264,
        volume_symbol: 'ETH',
        sales: 78905,
        num_owners: 6811,
        floor_price: 0.88,
        floor_price_symbol: 'USDG',
      },
      intervals: [
        { interval: 'one_day', volume: 3.9374628655823294, volume_symbol: 'ETH', sales: 658 },
        { interval: 'seven_day', volume: 79.15593692451263, volume_symbol: 'ETH', sales: 12748 },
        { interval: 'thirty_day', volume: 258.32910547684395, volume_symbol: 'ETH', sales: 78905 },
      ],
    });
    if (!r.success) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(r.error.issues, null, 2));
    }
    expect(r.success).toBe(true);
  });
});
