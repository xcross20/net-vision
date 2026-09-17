import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import type { Order } from '@net-vision/opensea-client';
import { applyObservation } from '../market/listing-state';
import {
  listingRecord,
  maintenanceState,
  resetIndexForTests,
  writeListing,
} from './store';
import {
  ORDERBOOK_PAGE_LIMIT,
  applyFetchedAskSet,
  askFromOrder,
  fetchCompleteAskSet,
  type CollectionListingsPage,
} from './orderbook-reconcile';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';

function order(tokenId: string, priceValue: string, hash = `0x${tokenId}`): Order {
  return {
    order_hash: hash,
    chain: 'Robinhood',
    protocol_address: SEAPORT,
    protocol_data: {
      parameters: {
        offerer: '0x0000000000000000000000000000000000000abc',
        startTime: '1700000000',
        offer: [
          {
            itemType: 2,
            identifierOrCriteria: tokenId,
            token: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
          },
        ],
      },
    },
    asset: {
      identifier: tokenId,
      contract: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
    },
    price: { current: { currency: 'USDG', decimals: 6, value: priceValue } },
  } as unknown as Order;
}

function seedListed(tokenId: string, price: number): void {
  const listed = applyObservation(listingRecord(tokenId), {
    kind: 'ask',
    price,
    currency: 'USDG',
    orderHash: `0xold${tokenId}`,
    seller: null,
    listedAt: 1,
  });
  writeListing({ ...listed, lastVerifiedAt: Date.now() });
}

describe('askFromOrder', () => {
  it('reads token id from asset.identifier and skips discovery-envelope ids', () => {
    expect(askFromOrder(order('928', '890000000'))?.tokenId).toBe('928');
    expect(askFromOrder(order('62095', '1000000'))).toBeNull();
  });
});

describe('fetchCompleteAskSet', () => {
  it('is complete when next is null', async () => {
    const pages: CollectionListingsPage[] = [
      { listings: [order('1', '1000000'), order('2', '2000000')], next: null },
    ];
    const result = await fetchCompleteAskSet(async () => pages.shift()!);
    expect(result.complete).toBe(true);
    expect(result.asks.size).toBe(2);
    expect(result.reason).toBe('end');
  });

  it('keeps the cheaper ask when the same token appears twice', async () => {
    const result = await fetchCompleteAskSet(async () => ({
      listings: [order('10', '5000000', '0xa'), order('10', '3000000', '0xb')],
      next: null,
    }));
    expect(result.asks.get('10')?.price).toBe(3);
    expect(result.asks.get('10')?.orderHash).toBe('0xb');
  });

  it('treats a repeating full-page cursor as truncated, not complete', async () => {
    const listings = Array.from({ length: ORDERBOOK_PAGE_LIMIT }, (_, i) =>
      order(String(i + 1), '1000000'),
    );
    let calls = 0;
    const result = await fetchCompleteAskSet(async () => {
      calls += 1;
      return { listings, next: 'same' };
    });
    expect(calls).toBe(2);
    expect(result.complete).toBe(false);
    expect(result.reason).toBe('cursor-loop');
    expect(result.asks.size).toBe(ORDERBOOK_PAGE_LIMIT);
  });

  it('treats a repeating short page as complete', async () => {
    const result = await fetchCompleteAskSet(async () => ({
      listings: [order('7', '1000000')],
      next: 'loop',
    }));
    expect(result.complete).toBe(true);
    expect(result.reason).toBe('short-page');
    expect(result.asks.size).toBe(1);
  });

  it('completes a 75-ask OpenSea book when the cursor loops after a short page', async () => {
    const listings = Array.from({ length: 75 }, (_, i) => order(String(i + 1), '1000000'));
    const result = await fetchCompleteAskSet(async () => ({ listings, next: 'loop' }));
    expect(result.complete).toBe(true);
    expect(result.asks.size).toBe(75);
    expect(result.reason).toBe('short-page');
  });
});

describe('applyFetchedAskSet', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-ob-')), 'index.json');
    resetIndexForTests();
  });

  it('makes listed count match a complete OpenSea snapshot', () => {
    seedListed('12', 900);
    seedListed('99', 50);
    writeListing(listingRecord('50'));

    const asks = new Map([
      [
        '12',
        {
          tokenId: '12',
          price: 890,
          currency: 'USDG',
          orderHash: '0x12',
          seller: null,
          listedAt: 2,
        },
      ],
      [
        '731',
        {
          tokenId: '731',
          price: 900,
          currency: 'USDG',
          orderHash: '0x731',
          seller: null,
          listedAt: 2,
        },
      ],
    ]);

    const result = applyFetchedAskSet({
      complete: true,
      asks,
      pages: 1,
      reason: 'end',
    });

    expect(result.listed).toBe(2);
    expect(result.complete).toBe(true);
    expect(listingRecord('12').state).toBe('LISTED');
    expect(listingRecord('12').price).toBe(890);
    expect(listingRecord('731').state).toBe('LISTED');
    expect(listingRecord('99').state).toBe('UNLISTED_VERIFIED');
    expect(listingRecord('50').state).toBe('UNLISTED_VERIFIED');
    expect(maintenanceState().orderbookListedCount).toBe(2);
    expect(maintenanceState().orderbookComplete).toBe(true);
  });

  it('does not unlisted on an incomplete snapshot', () => {
    seedListed('99', 50);
    const asks = new Map([
      [
        '12',
        {
          tokenId: '12',
          price: 890,
          currency: 'USDG',
          orderHash: '0x12',
          seller: null,
          listedAt: 2,
        },
      ],
    ]);
    applyFetchedAskSet({
      complete: false,
      asks,
      pages: 2,
      reason: 'page-cap',
    });
    expect(listingRecord('12').state).toBe('LISTED');
    expect(listingRecord('99').state).toBe('LISTED');
    expect(maintenanceState().orderbookComplete).toBe(false);
  });

  it('does not demote on a full-page cursor-loop snapshot', () => {
    seedListed('99', 50);
    const asks = new Map([
      [
        '12',
        {
          tokenId: '12',
          price: 890,
          currency: 'USDG',
          orderHash: '0x12',
          seller: null,
          listedAt: 2,
        },
      ],
    ]);
    applyFetchedAskSet({
      complete: false,
      asks,
      pages: 2,
      reason: 'cursor-loop',
    });
    expect(listingRecord('12').state).toBe('LISTED');
    expect(listingRecord('99').state).toBe('LISTED');
  });
});
