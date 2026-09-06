/**
 * Walker pacing — the budget for best-listing REST lookups during the
 * listing bootstrap / drift loop. One invariant wins here: the walker
 * must complete the official Plate supply faster than OpenSea's
 * rate-limit policy churn, but never faster than what keeps the
 * page-path OpenSea callers (see open-sea-source.ts) safely below the
 * best-listing REST bucket.
 *
 * The previous design had `DRIFT_PACE_MS = 15_000` whenever Stream was
 * connected (lines 432 in worker.ts). That made the walker
 * effectively a drift detector and conflated "Stream is connected"
 * with "we can pace the walker slowly". Stream emits
 * listing/sale/cancel/transfer events only for tokens that were or are
 * listed; it cannot promote UNKNOWN -> UNLISTED_VERIFIED for tokens
 * that have never been listed. The walker is the only path that
 * closes that gap, so pacing it 15s per token meant coverage climbed
 * at ~4 tokens/min and 95% (LIVE) was weeks away.
 *
 * The fix: a single budget-aware helper, no streamConnected
 * branching, with a minimum-pace floor that any future change must
 * not violate (covered by walker-pace.test.ts).
 */

/** Steady-state walker pace (best-listing REST budget per token). */
export const WALKER_PACE_MS = 2_500;
/** Pace while inside the 5-minute 429 cooldown window. */
export const WALKER_COOLDOWN_PACE_MS = 30_000;
/**
 * Floor for walker pace. Best-listing REST cannot safely sustain
 * faster than this even when Stream is connected and page-path is
 * idle. The walker-pace.test.ts enforces this floor as an
 * impossible-state assertion.
 */
export const WALKER_MIN_PACE_MS = 1_500;

export type WalkerPaceInput = {
  /**
   * True if a 429 has been observed within the last
   * `RATE_LIMIT_COOLDOWN_MS` window. The caller computes this from
   * `workerCheckpoint().last429At`.
   */
  recentlyRateLimited: boolean;
};

export function walkerPaceMs(input: WalkerPaceInput): number {
  if (input.recentlyRateLimited) return WALKER_COOLDOWN_PACE_MS;
  // Floor guards any future caller from accidentally pacing faster
  // than the budget allows. If a future feature needs a faster pace,
  // lower this constant with intent, not by accident.
  return Math.max(WALKER_MIN_PACE_MS, WALKER_PACE_MS);
}