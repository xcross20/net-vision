import { describe, expect, it } from 'vitest';
import {
  WALKER_COOLDOWN_PACE_MS,
  WALKER_MIN_PACE_MS,
  WALKER_PACE_MS,
  walkerPaceMs,
} from './walker-pace';

describe('walkerPaceMs', () => {
  it('uses cooldown pace when recently rate-limited', () => {
    expect(walkerPaceMs({ recentlyRateLimited: true })).toBe(WALKER_COOLDOWN_PACE_MS);
  });

  it('uses steady-state pace when not rate-limited', () => {
    expect(walkerPaceMs({ recentlyRateLimited: false })).toBe(WALKER_PACE_MS);
  });

  it('never paces faster than the budget floor (impossible-state)', () => {
    // Future callers must not accidentally under-pace below the floor.
    expect(WALKER_PACE_MS).toBeGreaterThanOrEqual(WALKER_MIN_PACE_MS);
    expect(WALKER_COOLDOWN_PACE_MS).toBeGreaterThanOrEqual(WALKER_MIN_PACE_MS);
    expect(walkerPaceMs({ recentlyRateLimited: false })).toBeGreaterThanOrEqual(
      WALKER_MIN_PACE_MS,
    );
    expect(walkerPaceMs({ recentlyRateLimited: true })).toBeGreaterThanOrEqual(
      WALKER_MIN_PACE_MS,
    );
  });

  it('treats streamConnected as irrelevant (regression: DRIFT_PACE_MS removed)', () => {
    // Previously the worker branched on maintenanceState().streamConnected
    // and slowed to 15s when Stream was up. That special case must not
    // exist in walkerPaceMs — the helper ignores streamConnected entirely.
    const a = walkerPaceMs({ recentlyRateLimited: false });
    const b = walkerPaceMs({ recentlyRateLimited: false });
    expect(a).toBe(b);
    expect(a).toBeLessThanOrEqual(WALKER_PACE_MS);
  });
});