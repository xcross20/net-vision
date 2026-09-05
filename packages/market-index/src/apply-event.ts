/**
 * Pure event → listing-state transition.
 * Explicit Stream cancels / sales demote immediately; auditor REST
 * no-ask still uses the multi-miss threshold via applyObservation.
 */
import {
  applyObservation,
  emptyListingRecord,
  type ListingObservation,
  type ListingRecord,
} from './listing-state';
import type { MarketEvent } from './events';

export type ApplyEventResult = {
  listing: ListingRecord;
  /** True when the listing row should be written. */
  touchedListing: boolean;
  clearListing: boolean;
};

export function observationFromEvent(event: MarketEvent): ListingObservation | null {
  switch (event.type) {
    case 'listing_created':
    case 'order_revalidate':
      if (event.price == null || !Number.isFinite(event.price)) return null;
      return {
        kind: 'ask',
        price: event.price,
        currency: event.currency ?? 'USDG',
        orderHash: event.orderHash,
        seller: event.seller,
        listedAt: event.occurredAt,
      };
    case 'listing_cancelled':
    case 'sale':
    case 'order_invalidate':
      return { kind: 'no-ask' };
    case 'transfer':
      // Transfer clears listing only when we treat it as leaving the maker;
      // caller may pass a synthetic no-ask after owner update.
      return { kind: 'no-ask' };
    default:
      return null;
  }
}

/**
 * For Stream/REST explicit cancel/sale: force UNLISTED_VERIFIED in one step
 * (do not require three auditor misses).
 */
export function applyMarketEvent(
  current: ListingRecord | null,
  event: MarketEvent,
  now = Date.now(),
): ApplyEventResult {
  const base = current ?? emptyListingRecord(event.tokenId);

  if (event.type === 'listing_cancelled' || event.type === 'sale' || event.type === 'order_invalidate') {
    return {
      listing: {
        ...base,
        state: 'UNLISTED_VERIFIED',
        price: null,
        currency: null,
        orderHash: null,
        seller: null,
        listedAt: null,
        lastVerifiedAt: now,
        consecutive404s: Math.max(base.consecutive404s, 1),
      },
      touchedListing: true,
      clearListing: true,
    };
  }

  if (event.type === 'listing_created' || event.type === 'order_revalidate') {
    const observation = observationFromEvent(event);
    if (!observation || observation.kind !== 'ask') {
      return { listing: base, touchedListing: false, clearListing: false };
    }
    return {
      listing: applyObservation(base, observation, now),
      touchedListing: true,
      clearListing: false,
    };
  }

  if (event.type === 'transfer') {
    return {
      listing: {
        ...base,
        state: base.state === 'UNKNOWN' ? 'UNKNOWN' : 'UNLISTED_VERIFIED',
        price: null,
        currency: null,
        orderHash: null,
        seller: null,
        listedAt: null,
        lastVerifiedAt: now,
        consecutive404s: base.consecutive404s,
      },
      touchedListing: base.state === 'LISTED' || base.state === 'STALE',
      clearListing: base.state === 'LISTED' || base.state === 'STALE',
    };
  }

  return { listing: base, touchedListing: false, clearListing: false };
}
