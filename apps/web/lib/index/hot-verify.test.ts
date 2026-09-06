import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { applyObservation } from '../market/listing-state';
import { listingRecord, resetIndexForTests, writeListing } from './store';
import { pickHotVerifyIds, runHotVerifyBatch } from './hot-verify';

describe('hot listing verify', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-hot-')), 'index.json');
    resetIndexForTests();
  });

  it('recovery path: missed cancel is picked as STALE/LISTED and unverified by best-listing', async () => {
    const listed = applyObservation(listingRecord('966'), {
      kind: 'ask',
      price: 650,
      currency: 'USDG',
      orderHash: '0xfloor',
      seller: null,
      listedAt: 1,
    });
    writeListing({ ...listed, lastVerifiedAt: Date.now() });
    expect(pickHotVerifyIds(1)).toEqual(['966']);
    await runHotVerifyBatch(async () => ({ kind: 'no-ask' }));
    expect(listingRecord('966').state).not.toBe('LISTED');
  });
});
