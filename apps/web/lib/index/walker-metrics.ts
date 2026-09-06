/**
 * Walker throughput + coverage-rise observability.
 *
 * The walker is the only path that can promote UNKNOWN ->
 * UNLISTED_VERIFIED, so its pace is the single biggest driver of
 * coverage. Before this file, the only signal that the walker had
 * stalled was the workerOnline heartbeat (always green) and the
 * slow-moving cursor field. A stalled walker looked identical to a
 * healthy walker until someone eyeballed the coverage number
 * minutes later.
 *
 * Surface two rate metrics:
 *  - walkerTokensPerMinute      — last 5 min, derived from the
 *                                  listing worker's processedTotal.
 *  - coverageRisePercentPerHour — last 5 min, derived from
 *                                  countVerifiedListings() / official
 *                                  supply. Negative deltas are
 *                                  clamped to 0 (a checkpoint
 *                                  rollback would otherwise show as a
 *                                  negative rise rate).
 *
 * Both metrics stay in module scope. The snapshot is small (≤ ~120
 * samples per window) and not persisted — on worker restart the
 * window is empty until new samples arrive, which is the right
 * signal ("we don't know yet, the worker just restarted").
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';

const METRICS_WINDOW_MS = 5 * 60_000;
const TOTAL_SUPPLY = BUTTON_PRESSER_COLLECTION.officialExistingSupply;

type Sample = {
  at: number;
  processedTotal: number;
  verifiedCount: number;
};

let samples: Sample[] = [];

export function recordWalkerTick(
  input: { processedTotal: number; verifiedCount: number },
  at = Date.now(),
): void {
  samples.push({
    at,
    processedTotal: input.processedTotal,
    verifiedCount: input.verifiedCount,
  });
  trim(samples, at);
}

export function resetWalkerMetricsForTests(): void {
  samples = [];
}

function trim(buf: Sample[], at: number): void {
  const cutoff = at - METRICS_WINDOW_MS;
  while (buf.length > 0 && buf[0]!.at < cutoff) buf.shift();
}

function window(now: number): readonly Sample[] {
  const cutoff = now - METRICS_WINDOW_MS;
  let i = 0;
  while (i < samples.length && samples[i]!.at < cutoff) i += 1;
  return samples.slice(i);
}

/** Tokens processed per minute, averaged over the rolling window. */
export function walkerTokensPerMinute(now = Date.now()): number | null {
  const w = window(now);
  if (w.length < 2) return null;
  const first = w[0]!;
  const last = w[w.length - 1]!;
  const elapsed = last.at - first.at;
  if (elapsed <= 0) return null;
  const delta = last.processedTotal - first.processedTotal;
  // Negative delta would mean a checkpoint rollback. Treat as 0
  // rather than reporting a misleading negative rate.
  return Math.max(0, Math.round((delta * 60_000) / elapsed));
}

/**
 * Verified-listing coverage rise as percent-per-hour.
 * coverage = verifiedCount / officialExistingSupply (62093).
 * Returns 0 when the verified count did not rise in the window
 * (the most important signal: "walker stalled, coverage flat").
 */
export function coverageRisePercentPerHour(now = Date.now()): number | null {
  const w = window(now);
  if (w.length < 2) return null;
  const first = w[0]!;
  const last = w[w.length - 1]!;
  const elapsed = last.at - first.at;
  if (elapsed <= 0) return null;
  const delta = last.verifiedCount - first.verifiedCount;
  // % per hour = (delta / supply) * (3_600_000 / elapsed)
  const pctPerHour = (delta / TOTAL_SUPPLY) * (3_600_000 / elapsed);
  // Round to 4 decimals to avoid 0.0000001 noise.
  return Math.max(0, Math.round(pctPerHour * 10_000) / 10_000);
}

export const __TESTING__ = { METRICS_WINDOW_MS, TOTAL_SUPPLY };