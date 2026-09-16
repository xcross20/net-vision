import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { applyObservation, LISTED_TTL_MS } from '../market/listing-state';
import { TokenCatalog } from '../market/catalog';
import { rehydrateCatalogFromIndex } from '../market/rehydrate-catalog';
import { applyMarketEvent } from './apply-event';
import { buildIndexerHealthReport } from './health';
import { streamMessageToMarketEvent } from './market-event';
import {
  listingBootstrapComplete,
  listingRecord,
  resetIndexForTests,
  workerCheckpoint,
  writeListing,
  writeWorkerCheckpoint,
} from './store';

const RANGE = { minTokenId: 1, maxTokenId: 999 };

describe('boot last-known listings, patch live OpenSea diffs', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-boot-')), 'index.json');
    resetIndexForTests();
  });

  it('treats a finished first pass as complete even if the stored phase is still bootstrap', () => {
    writeWorkerCheckpoint({
      phase: 'bootstrap',
      cursor: 0,
      processedTotal: BUTTON_PRESSER_COLLECTION.maxTokenId,
    });
    expect(listingBootstrapComplete(workerCheckpoint())).toBe(true);
  });

  it('does not treat a mid-bootstrap cursor as complete', () => {
    writeWorkerCheckpoint({
      phase: 'bootstrap',
      cursor: 37186,
      processedTotal: 37186,
    });
    expect(listingBootstrapComplete(workerCheckpoint())).toBe(false);
  });

  it('keeps last-known LISTED across listing TTL without a live observation', () => {
    const listed = applyObservation(listingRecord('628'), {
      kind: 'ask',
      price: 560,
      currency: 'USDG',
      orderHash: '0x628',
      seller: null,
      listedAt: 1,
    });
    writeListing({ ...listed, lastVerifiedAt: Date.now() - LISTED_TTL_MS - 1 });
    expect(listingRecord('628').state).toBe('LISTED');
    expect(listingRecord('628').price).toBe(560);

    const catalog = new TokenCatalog(RANGE);
    rehydrateCatalogFromIndex(catalog);
    expect(catalog.isListed('628')).toBe(true);
    expect(catalog.categoryTotals('digits-3').listedCount).toBe(1);
  });

  it('reports listing progress 100 after bootstrap so a cursor wrap is not a resync', () => {
    writeWorkerCheckpoint({
      phase: 'hot-refresh',
      cursor: 0,
      processedTotal: BUTTON_PRESSER_COLLECTION.maxTokenId,
      bootstrapComplete: true,
    });
    const report = buildIndexerHealthReport();
    expect(report.listingProgressPercent).toBe(100);
    expect(report.listingWorker.bootstrapComplete).toBe(true);
    expect(report.listingCursor).toBe(0);
  });

  it('patches a new live ask and a cancel without a full-supply walk', () => {
    writeListing(
      applyObservation(listingRecord('628'), {
        kind: 'ask',
        price: 560,
        currency: 'USDG',
        orderHash: '0x628',
        seller: null,
        listedAt: 1,
      }),
    );
    const listed = streamMessageToMarketEvent({
      event_type: 'item_listed',
      payload: {
        item: { nft_id: 'robinhood/0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2/966' },
        base_price: '650000000',
        payment_token: { symbol: 'USDG', decimals: 6 },
        order_hash: '0x966',
      },
    });
    expect(applyMarketEvent(listed!)).toBe('applied');
    expect(listingRecord('966').state).toBe('LISTED');
    expect(listingRecord('628').state).toBe('LISTED');

    const cancelled = streamMessageToMarketEvent({
      event_type: 'item_cancelled',
      payload: {
        item: { nft_id: 'robinhood/0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2/628' },
        order_hash: '0x628',
      },
    });
    expect(applyMarketEvent(cancelled!)).toBe('applied');
    expect(listingRecord('628').state).toBe('UNLISTED_VERIFIED');
    expect(listingRecord('966').state).toBe('LISTED');
  });
});
