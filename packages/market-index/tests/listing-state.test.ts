import { describe, expect, it } from 'vitest';
import {
  applyObservation,
  categoryReadiness,
  coveragePercent,
  decayIfStale,
  emptyListingRecord,
  LISTED_TTL_MS,
  marketStatus,
} from '../src/listing-state';

describe('listing state machine', () => {
  it('starts unknown and does not treat that as unlisted', () => {
    const record = emptyListingRecord('628');
    expect(record.state).toBe('UNKNOWN');
  });

  it('moves to LISTED on an ask', () => {
    const next = applyObservation(emptyListingRecord('966'), {
      kind: 'ask',
      price: 540,
      currency: 'USDG',
      orderHash: '0xabc',
      seller: '0x0000000000000000000000000000000000000abc',
      listedAt: 1,
    });
    expect(next.state).toBe('LISTED');
    expect(next.price).toBe(540);
  });

  it('moves to UNLISTED_VERIFIED on a no-ask observation from UNKNOWN', () => {
    const next = applyObservation(emptyListingRecord('967'), { kind: 'no-ask' });
    expect(next.state).toBe('UNLISTED_VERIFIED');
    expect(next.price).toBeNull();
  });

  it('does not drop a LISTED floor on a single flaky no-ask', () => {
    const listed = applyObservation(emptyListingRecord('966'), {
      kind: 'ask',
      price: 650,
      currency: 'USDG',
      orderHash: '0xfloor',
      seller: null,
      listedAt: 1,
    });
    const once = applyObservation(listed, { kind: 'no-ask' });
    expect(once.state).toBe('STALE');
    expect(once.price).toBe(650);
    const twice = applyObservation(once, { kind: 'no-ask' });
    expect(twice.state).toBe('STALE');
    const thrice = applyObservation(twice, { kind: 'no-ask' });
    expect(thrice.state).toBe('UNLISTED_VERIFIED');
    expect(thrice.price).toBeNull();
  });

  it('does not invent an unlisted state from a transport error', () => {
    const next = applyObservation(emptyListingRecord('968'), { kind: 'error' });
    expect(next.state).toBe('UNKNOWN');
  });

  it('decays LISTED to STALE after the listed TTL', () => {
    const listed = applyObservation(emptyListingRecord('870'), {
      kind: 'ask',
      price: 1,
      currency: 'USDG',
      orderHash: '0x1',
      seller: null,
      listedAt: 1,
    });
    const stale = decayIfStale(listed, (listed.lastVerifiedAt ?? 0) + LISTED_TTL_MS + 1);
    expect(stale.state).toBe('STALE');
  });

  it('keeps coverage below live until 95% of members are verified', () => {
    expect(coveragePercent(429, 900)).toBeCloseTo(0.4766, 3);
    expect(marketStatus(0.4766)).toBe('syncing');
    expect(marketStatus(0.95)).toBe('live');
  });

  it('treats an empty membership set as uncovered, not live', () => {
    expect(coveragePercent(0, 0)).toBe(0);
    expect(marketStatus(0)).toBe('syncing');
  });

  it('does not mark unhydrated Brass as live', () => {
    const readiness = categoryReadiness({
      source: 'metadata',
      expectedSupply: 999,
      discoveredMembers: 0,
      verifiedMarketMembers: 0,
    });
    expect(readiness.membershipCoverage).toBe(0);
    expect(readiness.marketCoverage).toBe(0);
    expect(readiness.marketStatus).toBe('syncing');
  });

  it('requires both membership and market coverage for metadata LIVE', () => {
    expect(
      categoryReadiness({
        source: 'metadata',
        expectedSupply: 999,
        discoveredMembers: 999,
        verifiedMarketMembers: 500,
      }).marketStatus,
    ).toBe('syncing');
    expect(
      categoryReadiness({
        source: 'metadata',
        expectedSupply: 999,
        discoveredMembers: 999,
        verifiedMarketMembers: 980,
      }).marketStatus,
    ).toBe('live');
  });
});


