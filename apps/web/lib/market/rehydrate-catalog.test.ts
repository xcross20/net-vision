import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { applyObservation } from './listing-state';
import { TokenCatalog } from './catalog';
import { rehydrateCatalogFromIndex } from './rehydrate-catalog';
import { listingRecord, resetIndexForTests, writeListing } from '@/lib/index/store';

const RANGE = { minTokenId: 1, maxTokenId: 999 };

describe('rehydrateCatalogFromIndex', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-rehy-')), 'index.json');
    resetIndexForTests();
  });

  it('makes a worker-written LISTED ask visible on a pre-existing catalog', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.classify();
    expect(catalog.categoryTotals('digits-3').listedCount).toBe(0);

    const listed = applyObservation(listingRecord('628'), {
      kind: 'ask',
      price: 560,
      currency: 'USDG',
      orderHash: '0x628',
      seller: null,
      listedAt: Date.now(),
    });
    writeListing(listed);
    rehydrateCatalogFromIndex(catalog);
    expect(catalog.categoryTotals('digits-3').listedCount).toBe(1);
    expect(catalog.isListed('628')).toBe(true);
  });

  it('drops a cancelled ask after the worker writes UNLISTED_VERIFIED', () => {
    const catalog = new TokenCatalog(RANGE);
    const listed = applyObservation(listingRecord('628'), {
      kind: 'ask',
      price: 560,
      currency: 'USDG',
      orderHash: '0x628',
      seller: null,
      listedAt: Date.now(),
    });
    writeListing(listed);
    rehydrateCatalogFromIndex(catalog);
    expect(catalog.isListed('628')).toBe(true);

    const cancelled = applyObservation(listed, { kind: 'cancel', orderHash: '0x628' });
    writeListing(cancelled);
    rehydrateCatalogFromIndex(catalog);
    expect(catalog.isListed('628')).toBe(false);
    expect(catalog.categoryTotals('digits-3').listedCount).toBe(0);
  });
});
