/**
 * A4 SQL read-model semantics.
 *
 * Blob path still uses listing-state.ts categoryReadiness (95% TTL-fresh
 * LISTED|UNLISTED_VERIFIED). This module is SQL-only: bootstrap coverage
 * is "ever established", not "fresh inside TTL".
 */
import type { ListingState } from './listing-state';

export type RealtimeHealth = 'live' | 'degraded' | 'offline';

/** Collection/category is live for SQL once this share of members has any established state. */
export const BOOTSTRAP_COMPLETE_THRESHOLD = 0.95;

export const HEARTBEAT_OFFLINE_MS = 60_000;

/** LISTED, UNLISTED_VERIFIED, or STALE — observed at least once. UNKNOWN is not. */
export function isEstablishedListingState(state: ListingState | null | undefined): boolean {
  return state === 'LISTED' || state === 'UNLISTED_VERIFIED' || state === 'STALE';
}

export function bootstrapCoverage(establishedCount: number, expected: number): number {
  if (expected <= 0) return 0;
  return establishedCount / expected;
}

export function bootstrapMarketStatus(coverage: number): 'syncing' | 'live' {
  return coverage >= BOOTSTRAP_COMPLETE_THRESHOLD ? 'live' : 'syncing';
}

export function categoryFloors(
  listedPrices: number[],
  stalePrices: number[],
): { floorPrice: number | null; lastKnownFloorPrice: number | null } {
  return {
    floorPrice: listedPrices.length > 0 ? Math.min(...listedPrices) : null,
    lastKnownFloorPrice: stalePrices.length > 0 ? Math.min(...stalePrices) : null,
  };
}

export function realtimeHealth(input: {
  workerOnline: boolean;
  streamConnected: boolean;
  heartbeatAgeMs: number | null;
}): RealtimeHealth {
  if (!input.workerOnline) return 'offline';
  if (input.heartbeatAgeMs != null && input.heartbeatAgeMs > HEARTBEAT_OFFLINE_MS) return 'offline';
  if (!input.streamConnected) return 'degraded';
  return 'live';
}
