import { describe, expect, it } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import {
  BOOTSTRAP_COMPLETE_THRESHOLD,
  bootstrapCoverage,
  bootstrapMarketStatus,
  categoryFloors,
  isEstablishedListingState,
  realtimeHealth,
} from './sql-readiness';

describe('A4 SQL readiness', () => {
  it('treats STALE as established so a seeded universe does not revert to bootstrap syncing', () => {
    const supply = BUTTON_PRESSER_COLLECTION.officialExistingSupply;
    const established = supply;
    const coverage = bootstrapCoverage(established, supply);
    expect(coverage).toBe(1);
    expect(bootstrapMarketStatus(coverage)).toBe('live');
    expect(isEstablishedListingState('STALE')).toBe(true);
    expect(isEstablishedListingState('UNLISTED_VERIFIED')).toBe(true);
    expect(isEstablishedListingState('UNKNOWN')).toBe(false);
  });

  it('does not count TTL aging as a coverage drop: all-STALE is still live', () => {
    expect(bootstrapMarketStatus(0.95)).toBe('live');
    expect(BOOTSTRAP_COMPLETE_THRESHOLD).toBe(0.95);
    expect(bootstrapMarketStatus(0.949)).toBe('syncing');
  });

  it('keeps current LISTED floor when an unrelated member is stale', () => {
    const { floorPrice, lastKnownFloorPrice } = categoryFloors([41, 99], [10]);
    expect(floorPrice).toBe(41);
    expect(lastKnownFloorPrice).toBe(10);
  });

  it('exposes last-known floor when the floor-defining listing is stale and nothing is LISTED', () => {
    const { floorPrice, lastKnownFloorPrice } = categoryFloors([], [41, 80]);
    expect(floorPrice).toBeNull();
    expect(lastKnownFloorPrice).toBe(41);
  });

  it('does not treat realtime offline as missing market knowledge', () => {
    expect(
      realtimeHealth({ workerOnline: false, streamConnected: false, heartbeatAgeMs: 120_000 }),
    ).toBe('offline');
    expect(
      realtimeHealth({ workerOnline: true, streamConnected: false, heartbeatAgeMs: 1_000 }),
    ).toBe('degraded');
    expect(
      realtimeHealth({ workerOnline: true, streamConnected: true, heartbeatAgeMs: 1_000 }),
    ).toBe('live');
  });
});
