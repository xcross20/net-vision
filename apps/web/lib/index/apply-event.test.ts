import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { applyMarketEvent } from './apply-event';
import { restEventToMarketEvent, streamMessageToMarketEvent } from './market-event';
import { listingRecord, allSales, resetIndexForTests } from './store';
import type { AssetEvent } from '@net-vision/opensea-client';

describe('market event apply', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-evt-')), 'index.json');
    resetIndexForTests();
  });

  it('lists a token from a Stream item_listed payload without a full scan', () => {
    const event = streamMessageToMarketEvent({
      event_type: 'item_listed',
      sent_at: '2026-09-05T12:00:00Z',
      payload: {
        item: { nft_id: 'robinhood/0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2/966' },
        base_price: '540000000',
        payment_token: { symbol: 'USDG', decimals: 6 },
        order_hash: '0xabc',
        maker: { address: '0x0000000000000000000000000000000000000abc' },
        event_timestamp: '2026-09-05T12:00:00Z',
      },
    });
    expect(event?.tokenId).toBe('966');
    expect(event?.kind).toBe('listed');
    expect(applyMarketEvent(event!)).toBe('applied');
    expect(listingRecord('966').state).toBe('LISTED');
    expect(listingRecord('966').price).toBe(540);
    expect(applyMarketEvent(event!)).toBe('duplicate');
  });

  it('unlists on cancel and records a sale without walking the collection', () => {
    const listed = streamMessageToMarketEvent({
      event_type: 'item_listed',
      payload: {
        item: { nft_id: 'ethereum/0xabc/870' },
        base_price: '100000000',
        payment_token: { symbol: 'USDG', decimals: 6 },
        order_hash: '0xsale',
      },
    });
    applyMarketEvent(listed!);
    const sold = streamMessageToMarketEvent({
      event_type: 'item_sold',
      payload: {
        item: { nft_id: 'ethereum/0xabc/870' },
        sale_price: '100000000',
        payment_token: { symbol: 'USDG', decimals: 6 },
        order_hash: '0xsale',
        taker: { address: '0x0000000000000000000000000000000000000def' },
        event_timestamp: 1788610000,
      },
    });
    expect(applyMarketEvent(sold!)).toBe('applied');
    expect(listingRecord('870').state).toBe('UNLISTED_VERIFIED');
    expect(allSales().some((s) => s.tokenId === '870' && s.price === 100)).toBe(true);
  });

  it('parses REST collection events into the same shape', () => {
    const raw = {
      event_type: 'listing',
      event_timestamp: 1788610000,
      order_hash: '0xrest',
      nft: { identifier: '628' },
      payment: { quantity: '250000000', decimals: 6, symbol: 'USDG' },
      seller: { address: '0x0000000000000000000000000000000000000123' },
    } as AssetEvent;
    const event = restEventToMarketEvent(raw, 1788610000000);
    expect(event?.kind).toBe('listed');
    expect(event?.tokenId).toBe('628');
    expect(event?.price).toBe(250);
    expect(applyMarketEvent(event!)).toBe('applied');
    expect(listingRecord('628').state).toBe('LISTED');
  });
});
