import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyListingRecord, type ListingRecord } from '../market/listing-state';
import { MemoryMarketRepository } from './memory-market-repository';
import type { IndexSnapshot } from './store';
import {
  seedSqlFromLegacySnapshot,
  shouldApplySnapshotListing,
  snapshotListingWatermarkMs,
  xorTokenIds,
} from './seed-sql-from-legacy-snapshot';

const here = dirname(fileURLToPath(import.meta.url));

function listing(partial: Partial<ListingRecord> & Pick<ListingRecord, 'tokenId' | 'state'>): ListingRecord {
  return {
    ...emptyListingRecord(partial.tokenId),
    ...partial,
  };
}

function snapshot(listings: ListingRecord[]): IndexSnapshot {
  return {
    version: 1,
    taxonomyVersion: 'test',
    historyStartedAt: 1,
    snapshotRevision: 99,
    tokens: Object.fromEntries(
      listings.map((row) => [
        row.tokenId,
        {
          tokenId: row.tokenId,
          displayNumber: row.tokenId,
          exists: true,
          name: null,
          imageUrl: null,
          ownerAddress: row.seller,
          metadataJson: null,
          metadataVerifiedAt: null,
          lastSeenAt: row.lastVerifiedAt ?? 1,
        },
      ]),
    ),
    listings: Object.fromEntries(listings.map((row) => [row.tokenId, row])),
    categories: {},
    tokenFacets: {},
    sales: [],
    saleAttributions: [],
    floorHistory: {},
    worker: {
      phase: 'bootstrap',
      cursor: 0,
      processedTotal: 0,
      lastTickAt: 0,
      lastError: null,
      last429At: null,
      workerStartedAt: null,
      workerHeartbeatAt: null,
      lastSuccessAt: null,
      walkerTokensPerMinute: null,
      coverageRisePercentPerHour: null,
      sqlWriter: null,
    },
    metadataWorker: {
      phase: 'brass-priority',
      cursor: 0,
      processedTotal: 0,
      missingTotal: 0,
      lastTickAt: 0,
      lastError: null,
      last429At: null,
      lastSuccessAt: null,
    },
    metadataRetryQueue: [],
    maintenance: {
      streamHealth: 'disconnected',
      streamSubscribed: false,
      streamConnected: false,
      streamLastEventAt: null,
      streamEventsTotal: 0,
      restLastEventAt: null,
      restEventsTotal: 0,
      restLastPollAt: null,
      lastError: null,
      seenEventIds: [],
      eventTimestamps: [],
      mode: 'rest',
    },
    restoredFrom: null,
  };
}

describe('shouldApplySnapshotListing', () => {
  it('applies when SQL has no row', () => {
    expect(shouldApplySnapshotListing(null, 100)).toBe(true);
  });

  it('skips when a newer SQL event high-water exists', () => {
    expect(
      shouldApplySnapshotListing({ stateEventAt: 200, lastVerifiedAt: 200 }, 100),
    ).toBe(false);
  });

  it('applies when snapshot watermark is at least as new as SQL', () => {
    expect(
      shouldApplySnapshotListing({ stateEventAt: 100, lastVerifiedAt: 90 }, 100),
    ).toBe(true);
  });
});

describe('seedSqlFromLegacySnapshot', () => {
  it('writes all four listing states under collection_id and is idempotent', async () => {
    const repo = new MemoryMarketRepository();
    const snap = snapshot([
      listing({ tokenId: '1', state: 'UNKNOWN' }),
      listing({ tokenId: '2', state: 'LISTED', price: 10, orderHash: '0xa', lastVerifiedAt: 50 }),
      listing({ tokenId: '3', state: 'UNLISTED_VERIFIED', lastVerifiedAt: 60 }),
      listing({ tokenId: '4', state: 'STALE', price: 9, orderHash: '0xb', lastVerifiedAt: 40 }),
    ]);
    const first = await seedSqlFromLegacySnapshot({ repo, snapshot: snap, collectionId: 'button-presser' });
    expect(first.marketInserted).toBe(4);
    expect(first.listingStatesInSnapshot).toEqual({
      UNKNOWN: 1,
      LISTED: 1,
      UNLISTED_VERIFIED: 1,
      STALE: 1,
    });
    expect((await repo.getTokenMarketState('button-presser', 2))?.orderHash).toBe('0xa');
    expect((await repo.getTokenMarketState('button-presser', 2))?.collectionId).toBe('button-presser');

    const second = await seedSqlFromLegacySnapshot({ repo, snapshot: snap, collectionId: 'button-presser' });
    expect(second.marketInserted).toBe(0);
    expect(second.marketUpdated).toBe(4);
    expect((await repo.getTokenMarketState('button-presser', 2))?.price).toBe(10);
  });

  it('does not overwrite a newer live SQL event with an older snapshot row', async () => {
    const repo = new MemoryMarketRepository();
    await repo.upsertToken({
      collectionId: 'button-presser',
      tokenId: 966,
      displayNumber: '966',
      exists: true,
      ownerAddress: null,
      name: null,
      imageUrl: null,
      metadataJson: null,
      metadataVerifiedAt: null,
      lastSeenAt: 500,
    });
    await repo.upsertTokenMarketState({
      collectionId: 'button-presser',
      tokenId: 966,
      listingState: 'UNLISTED_VERIFIED',
      orderHash: null,
      price: null,
      currency: null,
      seller: null,
      listedAt: null,
      lastVerifiedAt: 500,
      consecutive404s: 0,
      stateEventAt: 500,
      stateEventId: 'LISTED:button-presser:966:0xlive',
      stateSource: 'opensea',
    });

    const snap = snapshot([
      listing({
        tokenId: '966',
        state: 'LISTED',
        price: 1.69,
        orderHash: '0xold',
        lastVerifiedAt: 100,
      }),
    ]);
    const report = await seedSqlFromLegacySnapshot({ repo, snapshot: snap });
    expect(report.marketSkippedNewer).toBe(1);
    expect(report.marketUpdated).toBe(0);
    const row = await repo.getTokenMarketState('button-presser', 966);
    expect(row?.listingState).toBe('UNLISTED_VERIFIED');
    expect(row?.stateSource).toBe('opensea');
  });

  it('source contains no full-table DELETE', () => {
    const src = readFileSync(join(here, 'seed-sql-from-legacy-snapshot.ts'), 'utf8');
    expect(src).not.toMatch(/DELETE FROM token_facets\s*;/);
    expect(src).not.toMatch(/DELETE FROM token_categories\s*;/);
    expect(src).not.toMatch(/DELETE FROM token_market_state/);
  });
});

describe('xorTokenIds', () => {
  it('reports exact set difference', () => {
    expect(xorTokenIds(['1', '2'], ['2', '3'])).toEqual({
      missingInActual: ['1'],
      extraInActual: ['3'],
    });
  });
});

describe('snapshotListingWatermarkMs', () => {
  it('prefers lastVerifiedAt over listedAt', () => {
    expect(
      snapshotListingWatermarkMs(
        listing({ tokenId: '1', state: 'LISTED', lastVerifiedAt: 9, listedAt: 3 }),
      ),
    ).toBe(9);
  });
});
