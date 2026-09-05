/**
 * Marketplace listing-state machine.
 *
 * Unknown is not unlisted. A token is only UNLISTED_VERIFIED after a
 * successful OpenSea best-listing lookup returned no active ask.
 * STALE means a previously verified state has passed its freshness TTL
 * and must be rechecked before it is treated as current.
 */

export const LISTING_STATES = ['UNKNOWN', 'LISTED', 'UNLISTED_VERIFIED', 'STALE'] as const;
export type ListingState = (typeof LISTING_STATES)[number];

export const UNLISTED_TTL_MS = 24 * 60 * 60 * 1000;
export const LISTED_TTL_MS = 6 * 60 * 60 * 1000;
/** Require multiple consecutive no-ask observations before UNLISTED_VERIFIED.
 * OpenSea best-listing on Robinhood intermittently 404s live asks. */
export const UNLISTED_404_THRESHOLD = 3;

export type ListingRecord = {
  tokenId: string;
  state: ListingState;
  price: number | null;
  currency: string | null;
  orderHash: string | null;
  seller: string | null;
  listedAt: number | null;
  lastVerifiedAt: number | null;
  consecutive404s: number;
};

export type ListingObservation =
  | { kind: 'ask'; price: number; currency: string; orderHash: string | null; seller: string | null; listedAt: number | null }
  | { kind: 'no-ask' }
  | { kind: 'error' };

export function emptyListingRecord(tokenId: string): ListingRecord {
  return {
    tokenId,
    state: 'UNKNOWN',
    price: null,
    currency: null,
    orderHash: null,
    seller: null,
    listedAt: null,
    lastVerifiedAt: null,
    consecutive404s: 0,
  };
}

export function isVerifiedState(state: ListingState): boolean {
  return state === 'LISTED' || state === 'UNLISTED_VERIFIED';
}

export function applyObservation(
  current: ListingRecord,
  observation: ListingObservation,
  now = Date.now(),
): ListingRecord {
  if (observation.kind === 'error') {
    return current.state === 'UNKNOWN'
      ? current
      : { ...current, state: 'STALE' };
  }
  if (observation.kind === 'ask') {
    return {
      ...current,
      state: 'LISTED',
      price: observation.price,
      currency: observation.currency,
      orderHash: observation.orderHash,
      seller: observation.seller,
      listedAt: observation.listedAt,
      lastVerifiedAt: now,
      consecutive404s: 0,
    };
  }
  const consecutive404s = current.consecutive404s + 1;
  // A single no-ask is enough from UNKNOWN. From LISTED/STALE, require
  // several consecutive misses — OpenSea best-listing on Robinhood 404s
  // live asks (floor tokens like #966 / #756) more often than it should.
  if (current.state === 'LISTED' || current.state === 'STALE') {
    const verified = consecutive404s >= UNLISTED_404_THRESHOLD;
    return {
      ...current,
      state: verified ? 'UNLISTED_VERIFIED' : 'STALE',
      price: verified ? null : current.price,
      currency: verified ? null : current.currency,
      orderHash: verified ? null : current.orderHash,
      seller: verified ? null : current.seller,
      listedAt: verified ? null : current.listedAt,
      lastVerifiedAt: now,
      consecutive404s,
    };
  }
  return {
    ...current,
    state: 'UNLISTED_VERIFIED',
    price: null,
    currency: null,
    orderHash: null,
    seller: null,
    listedAt: null,
    lastVerifiedAt: now,
    consecutive404s,
  };
}

export function decayIfStale(record: ListingRecord, now = Date.now()): ListingRecord {
  if (record.state === 'UNKNOWN' || record.state === 'STALE') return record;
  if (record.lastVerifiedAt == null) return { ...record, state: 'STALE' };
  const ttl = record.state === 'LISTED' ? LISTED_TTL_MS : UNLISTED_TTL_MS;
  if (now - record.lastVerifiedAt > ttl) {
    return { ...record, state: 'STALE' };
  }
  return record;
}

export function coveragePercent(verifiedCount: number, memberCount: number): number {
  if (memberCount <= 0) return 1;
  return verifiedCount / memberCount;
}

export function marketStatus(coverage: number): 'syncing' | 'live' {
  return coverage >= 0.95 ? 'live' : 'syncing';
}
