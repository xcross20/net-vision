import { describe, expect, it, beforeEach } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import {
  coverageRisePercentPerHour,
  recordWalkerTick,
  resetWalkerMetricsForTests,
  walkerTokensPerMinute,
} from './walker-metrics';

const TOTAL_SUPPLY = BUTTON_PRESSER_COLLECTION.officialExistingSupply;

describe('walker throughput metrics', () => {
  beforeEach(() => {
    resetWalkerMetricsForTests();
  });

  it('returns null for walkerTokensPerMinute with fewer than 2 samples', () => {
    expect(walkerTokensPerMinute()).toBeNull();
    recordWalkerTick({ processedTotal: 0, verifiedCount: 0 }, 1_000);
    expect(walkerTokensPerMinute(1_000)).toBeNull();
  });

  it('computes tokens-per-minute from window samples', () => {
    const start = 1_000;
    recordWalkerTick({ processedTotal: 0, verifiedCount: 0 }, start);
    recordWalkerTick({ processedTotal: 30, verifiedCount: 30 }, start + 60_000);
    expect(walkerTokensPerMinute(start + 60_000)).toBe(30);
  });

  it('clamps negative processedTotal delta to 0 (checkpoint rollback)', () => {
    const start = 1_000;
    recordWalkerTick({ processedTotal: 100, verifiedCount: 100 }, start);
    recordWalkerTick({ processedTotal: 50, verifiedCount: 50 }, start + 60_000);
    expect(walkerTokensPerMinute(start + 60_000)).toBe(0);
  });

  it('returns null for coverageRisePercentPerHour with fewer than 2 samples', () => {
    expect(coverageRisePercentPerHour()).toBeNull();
    recordWalkerTick({ processedTotal: 0, verifiedCount: 0 }, 1_000);
    expect(coverageRisePercentPerHour(1_000)).toBeNull();
  });

  it('computes coverage rise as percent-per-hour using official supply as denominator', () => {
    const start = 1_000;
    // 621 verified in 60s => 621 tokens/min; coverage rise = 621 / 62093 per hour
    recordWalkerTick({ processedTotal: 0, verifiedCount: 0 }, start);
    recordWalkerTick({ processedTotal: 621, verifiedCount: 621 }, start + 60_000);
    const expected = (621 / TOTAL_SUPPLY) * 60; // 60 min in an hour
    expect(coverageRisePercentPerHour(start + 60_000)).toBeCloseTo(expected, 4);
  });

  it('reports 0 rise when the verified count is flat (stalled walker signal)', () => {
    const start = 1_000;
    recordWalkerTick({ processedTotal: 0, verifiedCount: 1000 }, start);
    recordWalkerTick({ processedTotal: 60, verifiedCount: 1000 }, start + 60_000);
    expect(coverageRisePercentPerHour(start + 60_000)).toBe(0);
  });

  it('clamps negative verifiedCount delta to 0', () => {
    const start = 1_000;
    recordWalkerTick({ processedTotal: 0, verifiedCount: 1000 }, start);
    recordWalkerTick({ processedTotal: 60, verifiedCount: 900 }, start + 60_000);
    expect(coverageRisePercentPerHour(start + 60_000)).toBe(0);
  });

  it('trims samples older than the 5-minute window', () => {
    const t0 = 1_000;
    recordWalkerTick({ processedTotal: 0, verifiedCount: 0 }, t0);
    // 6 minutes later, the first sample is outside the window.
    const t1 = t0 + 6 * 60_000;
    recordWalkerTick({ processedTotal: 50, verifiedCount: 50 }, t1);
    // walkerTokensPerMinute cannot compute (only 1 sample in window)
    expect(walkerTokensPerMinute(t1)).toBeNull();
  });

  it('coverage rise is always non-negative (impossible-state)', () => {
    const start = 1_000;
    recordWalkerTick({ processedTotal: 100, verifiedCount: 100 }, start);
    recordWalkerTick({ processedTotal: 200, verifiedCount: 200 }, start + 30_000);
    const rise = coverageRisePercentPerHour(start + 30_000);
    expect(rise).not.toBeNull();
    expect(rise!).toBeGreaterThanOrEqual(0);
  });
});