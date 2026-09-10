import { describe, expect, it } from 'vitest';
import { cartReducer, initialCartState } from './reducer';
import type { CartItem } from './types';

function item(tokenId: string, hash: string): CartItem {
  return {
    collectionSlug: 'button-presser',
    contractAddress: '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2',
    tokenId,
    imageUrl: '/x',
    displayName: `#${tokenId}`,
    categories: [],
    sourceMarketplace: 'opensea',
    displayedOrderHash: hash,
    displayedPriceRaw: '1850000',
    displayedPriceDecimal: '1.85',
    currencySymbol: 'USDG',
    currencyAddress: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
    currencyDecimals: 6,
    addedAt: 1,
  };
}

describe('cart reducer', () => {
  it('UPSERT replaces snapshot fields for Buy now on an existing line', () => {
    const added = cartReducer(initialCartState, { type: 'ADD', item: item('777', '0xold') });
    const upserted = cartReducer(added, { type: 'UPSERT', item: item('777', '0xnew') });
    expect(upserted.items).toHaveLength(1);
    expect(upserted.items[0]?.displayedOrderHash).toBe('0xnew');
  });
});
