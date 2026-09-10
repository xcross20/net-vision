import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  listingRecord,
  metadataCheckpoint,
  persistNftMetadata,
  resetIndexForTests,
  snapshotRevision,
  saveIndex,
  writeListing,
} from './store';
import {
  PRIORITY_TOKEN_IDS,
  buildListedFirstMetadataQueue,
  buildMetadataQueue,
  metadataPaceMs,
  metadataShardCount,
  metadataShardIndex,
  runIndexerPass,
  runMetadataBootstrapPass,
  shardOwnsTokenId,
} from './worker';

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

  it('bumps snapshotRevision on each saveIndex', () => {
    expect(snapshotRevision()).toBe(0);
    saveIndex();
    expect(snapshotRevision()).toBe(1);
    saveIndex();
    expect(snapshotRevision()).toBe(2);
  });

  it('does not persist or bump revision when the process is not an index writer', async () => {
    const { indexWriterEnabled } = await import('./store');
    const previous = process.env.MARKET_INDEX_WRITER;
    process.env.MARKET_INDEX_WRITER = 'false';
    try {
      expect(indexWriterEnabled()).toBe(false);
      expect(snapshotRevision()).toBe(0);
      saveIndex();
      expect(snapshotRevision()).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.MARKET_INDEX_WRITER;
      else process.env.MARKET_INDEX_WRITER = previous;
    }
  });
});

describe('Plate metadata bootstrap', () => {
  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-meta-')), 'index.json');
    resetIndexForTests();
  });

  it('prioritizes 1..999 before the rest of supply', () => {
    const queue = buildMetadataQueue();
    expect(queue[0]).toBe('1');
    expect(queue[998]).toBe('999');
    expect(queue[999]).toBe('1000');
  });

  it('fetches metadata for Brass-range tokens and resumes the cursor', async () => {
    const fetched: string[] = [];
    const first = await runMetadataBootstrapPass(
      async (tokenId) => {
        fetched.push(tokenId);
        persistNftMetadata(tokenId, {
          name: `Button #${tokenId}`,
          imageUrl: `https://raw2.seadn.io/example/${tokenId}.svg`,
          ownerAddress: null,
          traits: [{ trait_type: 'Plate', value: 'Brass' }],
        });
        return { kind: 'found' };
      },
      { maxTokens: 3 },
    );
    expect(first.processed).toBe(3);
    expect(fetched).toEqual(['1', '2', '3']);
    expect(metadataCheckpoint().cursor).toBe(3);
    expect(metadataCheckpoint().phase).toBe('brass-priority');

    const second = await runMetadataBootstrapPass(
      async () => ({ kind: 'found' }),
      { maxTokens: 2 },
    );
    expect(second.cursor).toBe(5);
  });

  it('skips tokens that already have verified metadata', async () => {
    persistNftMetadata('1', {
      name: 'Button #1',
      traits: [{ trait_type: 'Plate', value: 'Brass' }],
    });
    const fetched: string[] = [];
    await runMetadataBootstrapPass(
      async (tokenId) => {
        fetched.push(tokenId);
        return { kind: 'found' };
      },
      { maxTokens: 2 },
    );
    // Token 1 skipped; fetch starts at 2.
    expect(fetched[0]).toBe('2');
    expect(metadataCheckpoint().cursor).toBe(2);
  });

  it('enqueues retry and advances the cursor (no head-of-line block)', async () => {
    const { metadataRetryQueue } = await import('./store');
    const first = await runMetadataBootstrapPass(
      async () => ({ kind: 'retry', reason: 'transient' }),
      { maxTokens: 1 },
    );
    expect(first.cursor).toBe(1);
    expect(metadataCheckpoint().lastError).toBe('transient');
    expect(metadataRetryQueue()).toHaveLength(1);
    expect(metadataRetryQueue()[0]?.tokenId).toBe('1');

    const fetched: string[] = [];
    await runMetadataBootstrapPass(
      async (tokenId) => {
        fetched.push(tokenId);
        return { kind: 'found' };
      },
      { maxTokens: 1 },
    );
    // Forward cursor continues at 2 even while 1 is in the retry queue.
    expect(fetched[0]).toBe('2');
    expect(metadataCheckpoint().cursor).toBe(2);
    expect(metadataRetryQueue()).toHaveLength(1);
  });

  it('advances on confirmed missing and marks the token settled', async () => {
    const result = await runMetadataBootstrapPass(
      async () => ({ kind: 'missing' }),
      { maxTokens: 2 },
    );
    expect(result.cursor).toBe(2);
    expect(result.missing).toBe(2);
    expect(metadataCheckpoint().cursor).toBe(2);
  });

  it('fetches LISTED tokens without verified metadata before the linear Brass cursor', async () => {
    writeListing({
      tokenId: '43866',
      state: 'LISTED',
      price: 1.85,
      currency: 'USDG',
      orderHash: '0x43866',
      seller: '0xabc',
      listedAt: 1,
      lastVerifiedAt: 1,
      consecutive404s: 0,
    });
    writeListing({
      tokenId: '1',
      state: 'UNLISTED_VERIFIED',
      price: null,
      currency: null,
      orderHash: null,
      seller: null,
      listedAt: null,
      lastVerifiedAt: 1,
      consecutive404s: 0,
    });
    expect(buildListedFirstMetadataQueue()).toEqual(['43866']);
    const fetched: string[] = [];
    const result = await runMetadataBootstrapPass(
      async (tokenId) => {
        fetched.push(tokenId);
        persistNftMetadata(tokenId, {
          name: `Button #${tokenId}`,
          imageUrl: `https://raw2.seadn.io/example/${tokenId}.svg`,
        });
        return { kind: 'found' };
      },
      { maxTokens: 1 },
    );
    expect(fetched).toEqual(['43866']);
    // Linear Brass cursor must not move — we drained a listed-first token.
    expect(result.cursor).toBe(0);
    expect(metadataCheckpoint().cursor).toBe(0);
  });

  it('does not pin listed-first drain on a token already in the retry queue', async () => {
    writeListing({
      tokenId: '43866',
      state: 'LISTED',
      price: 1.85,
      currency: 'USDG',
      orderHash: '0x43866',
      seller: null,
      listedAt: 1,
      lastVerifiedAt: 1,
      consecutive404s: 0,
    });
    await runMetadataBootstrapPass(
      async () => ({ kind: 'retry', reason: 'transient' }),
      { maxTokens: 1 },
    );
    expect(buildListedFirstMetadataQueue()).toEqual([]);
    const fetched: string[] = [];
    await runMetadataBootstrapPass(
      async (tokenId) => {
        fetched.push(tokenId);
        return { kind: 'found' };
      },
      { maxTokens: 1 },
    );
    // Retry is not yet due, so we walk the linear queue instead of re-pinning 43866.
    expect(fetched[0]).toBe('1');
  });
});

describe('metadata worker sharding', () => {
  const prevCount = process.env.METADATA_WORKER_SHARD_COUNT;
  const prevIndex = process.env.METADATA_WORKER_SHARD_INDEX;
  const prevPace = process.env.METADATA_PACE_MS;

  beforeEach(() => {
    process.env.INDEX_DB_PATH = join(mkdtempSync(join(tmpdir(), 'nv-shard-')), 'index.json');
    resetIndexForTests();
    delete process.env.METADATA_WORKER_SHARD_COUNT;
    delete process.env.METADATA_WORKER_SHARD_INDEX;
    delete process.env.METADATA_PACE_MS;
  });

  afterEach(() => {
    if (prevCount === undefined) delete process.env.METADATA_WORKER_SHARD_COUNT;
    else process.env.METADATA_WORKER_SHARD_COUNT = prevCount;
    if (prevIndex === undefined) delete process.env.METADATA_WORKER_SHARD_INDEX;
    else process.env.METADATA_WORKER_SHARD_INDEX = prevIndex;
    if (prevPace === undefined) delete process.env.METADATA_PACE_MS;
    else process.env.METADATA_PACE_MS = prevPace;
  });

  it('defaults to a single shard that owns every token', () => {
    expect(metadataShardCount()).toBe(1);
    expect(metadataShardIndex()).toBe(0);
    expect(shardOwnsTokenId('1')).toBe(true);
    expect(shardOwnsTokenId('43866')).toBe(true);
    expect(buildMetadataQueue()[0]).toBe('1');
    expect(buildMetadataQueue()[998]).toBe('999');
  });

  it('splits the linear queue by token_id % N', () => {
    process.env.METADATA_WORKER_SHARD_COUNT = '3';
    process.env.METADATA_WORKER_SHARD_INDEX = '1';
    expect(shardOwnsTokenId('1')).toBe(true); // 1 % 3 === 1
    expect(shardOwnsTokenId('2')).toBe(false);
    expect(shardOwnsTokenId('3')).toBe(false);
    expect(shardOwnsTokenId('4')).toBe(true);
    const queue = buildMetadataQueue();
    expect(queue[0]).toBe('1');
    expect(queue[1]).toBe('4');
    expect(queue.every((id) => Number(id) % 3 === 1)).toBe(true);
  });

  it('filters listed-first queue to this shard', () => {
    process.env.METADATA_WORKER_SHARD_COUNT = '3';
    process.env.METADATA_WORKER_SHARD_INDEX = '0';
    writeListing({
      tokenId: '43866', // 43866 % 3 === 0
      state: 'LISTED',
      price: 1.85,
      currency: 'USDG',
      orderHash: '0xa',
      seller: null,
      listedAt: 1,
      lastVerifiedAt: 1,
      consecutive404s: 0,
    });
    writeListing({
      tokenId: '43951', // 43951 % 3 === 1
      state: 'LISTED',
      price: 1.85,
      currency: 'USDG',
      orderHash: '0xb',
      seller: null,
      listedAt: 1,
      lastVerifiedAt: 1,
      consecutive404s: 0,
    });
    expect(buildListedFirstMetadataQueue()).toEqual(['43866']);
  });

  it('refuses METADATA_PACE_MS below 3000 on a single shard', () => {
    process.env.METADATA_PACE_MS = '1500';
    expect(metadataPaceMs()).toBe(3_000);
  });

  it('allows METADATA_PACE_MS=1500 when more than one shard is configured', () => {
    process.env.METADATA_WORKER_SHARD_COUNT = '3';
    process.env.METADATA_PACE_MS = '1500';
    expect(metadataPaceMs()).toBe(1_500);
  });
});


