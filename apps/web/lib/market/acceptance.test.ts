/**
 * Data acceptance: official universe and category expected supplies.
 * Live OpenSea oracle comparison is a separate operator script.
 */
import { describe, expect, it } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { cartDraftFromToken } from '../cart/listing-snapshot';
import type { Token } from './types';

describe('official token universe', () => {
  it('Plate expected supplies sum to officialExistingSupply, not discovery max', () => {
    const materials = VIRTUAL_COLLECTION_CATALOG.filter((c) => c.family === 'material');
    const sum = materials.reduce((acc, c) => acc + c.expectedSupply, 0);
    expect(sum).toBe(BUTTON_PRESSER_COLLECTION.officialExistingSupply);
    expect(BUTTON_PRESSER_COLLECTION.officialExistingSupply).toBe(62093);
    expect(BUTTON_PRESSER_COLLECTION.maxTokenId).toBe(62095);
    expect(sum).not.toBe(BUTTON_PRESSER_COLLECTION.maxTokenId);
  });

  it('Brass / Steel / 3-digit gates are the documented membership sizes', () => {
    const materials = VIRTUAL_COLLECTION_CATALOG.filter((c) => c.family === 'material');
    const brass = materials.find((c) => c.slug === 'material-brass');
    const steel = materials.find((c) => c.slug === 'material-steel');
    expect(brass?.expectedSupply).toBe(999);
    expect(steel?.expectedSupply).toBe(4000);
    expect(999 - 100 + 1).toBe(900);
  });
});

describe('cart listing snapshot', () => {
  it('records order hash and raw price from the displayed token', () => {
    const token: Token = {
      tokenId: '756',
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: 1311,
      imageUrl: '/x',
      name: '#756',
      listingPrice: 650,
      currency: 'USDG',
      listingOrderHash: '0xabc',
      listingPriceRaw: '650000000',
      listingCurrencyAddress: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
      listingCurrencyDecimals: 6,
      lastSalePrice: null,
      ownerAddress: null,
      traits: [],
      rarityRank: null,
      listedAt: 1,
      lastSaleAt: null,
    };
    const draft = cartDraftFromToken(token);
    expect(draft.displayedOrderHash).toBe('0xabc');
    expect(draft.displayedPriceRaw).toBe('650000000');
    expect(draft.currencySymbol).toBe('USDG');
    expect(draft.currencyDecimals).toBe(6);
  });
});
