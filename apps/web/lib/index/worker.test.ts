import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { resetIndexForTests, listingRecord } from './store';
import { PRIORITY_TOKEN_IDS, runIndexerPass } from './worker';

describe('listing reconciliation worker', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-index-')), 'index.json');
    resetIndexForTests();
  });

  it('records LISTED and UNLISTED_VERIFIED without treating errors as unlisted', async () => {
    const result = await runIndexerPass(
      async (tokenId) => {
        if (tokenId === '966') {
          return {
            kind: 'ask',
            price: 540,
            currency: 'USDG',
            orderHash: '0x966',
            seller: null,
            listedAt: 1,
          };
        }
        if (tokenId === '628') return { kind: 'no-ask' };
        return { kind: 'error' };
      },
      { maxTokens: 3 },
    );
    expect(result.processed).toBe(3);
    expect(PRIORITY_TOKEN_IDS.slice(0, 3)).toEqual(['966', '628', '870']);
    expect(listingRecord('966').state).toBe('LISTED');
    expect(listingRecord('966').price).toBe(540);
    expect(listingRecord('628').state).toBe('UNLISTED_VERIFIED');
    expect(listingRecord('870').state).toBe('UNKNOWN');
  });

  it('resumes from the persisted cursor', async () => {
    await runIndexerPass(async () => ({ kind: 'no-ask' }), { maxTokens: 2 });
    const second = await runIndexerPass(async () => ({ kind: 'no-ask' }), { maxTokens: 1 });
    expect(second.cursor).toBe(3);
    expect(listingRecord(PRIORITY_TOKEN_IDS[2]).state).toBe('UNLISTED_VERIFIED');
  });
});
