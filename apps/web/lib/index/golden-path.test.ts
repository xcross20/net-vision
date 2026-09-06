/**
 * Golden path (automated slice): list → cart snapshot → cancel → unlist.
 * Live wallet receipt is a manual operator test (TRADING_ENABLED).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { applyMarketEvent } from './apply-event';
import { streamMessageToMarketEvent } from './market-event';
import { listingRecord, resetIndexForTests } from './store';
import { cartDraftFromToken } from '../cart/listing-snapshot';
import type { Token } from '../market/types';

describe('golden path: list then cancel', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-gold-')), 'index.json');
    resetIndexForTests();
  });

  it('lists a token, snapshots the ask into the cart, then unlists on cancel', () => {
    const listed = streamMessageToMarketEvent({
      event_type: 'item_listed',
      payload: {
        item: { nft_id: 'robinhood/0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2/756' },
        base_price: '650000000',
        payment_token: { symbol: 'USDG', decimals: 6 },
        order_hash: '0xorder',
      },
    });
    expect(applyMarketEvent(listed!)).toBe('applied');
    expect(listingRecord('756').state).toBe('LISTED');
    expect(listingRecord('756').orderHash).toBe('0xorder');

    const token: Token = {
      tokenId: '756',
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      chainId: 1311,
      imageUrl: '/x',
      name: '#756',
      listingPrice: 650,
      currency: 'USDG',
      listingOrderHash: listingRecord('756').orderHash,
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
    expect(draft.displayedOrderHash).toBe('0xorder');
    expect(draft.displayedPriceRaw).toBe('650000000');

    const cancelled = streamMessageToMarketEvent({
      event_type: 'item_cancelled',
      payload: {
        item: { nft_id: 'robinhood/0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2/756' },
        order_hash: '0xorder',
      },
    });
    expect(applyMarketEvent(cancelled!)).toBe('applied');
    expect(listingRecord('756').state).toBe('UNLISTED_VERIFIED');
  });
});
