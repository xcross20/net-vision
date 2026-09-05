import { describe, expect, it } from 'vitest';
import { applyMarketEvent } from '../src/apply-event';
import { emptyListingRecord } from '../src/listing-state';
import { marketEventId, type MarketEvent } from '../src/events';

function event(partial: Partial<MarketEvent> & Pick<MarketEvent, 'type' | 'tokenId'>): MarketEvent {
  const occurredAt = partial.occurredAt ?? Date.now();
  return {
    marketplaceEventId:
      partial.marketplaceEventId ??
      marketEventId({
        type: partial.type,
        tokenId: partial.tokenId,
        orderHash: partial.orderHash,
        occurredAt,
      }),
    type: partial.type,
    tokenId: partial.tokenId,
    orderHash: partial.orderHash ?? '0xabc',
    price: partial.price ?? null,
    currency: partial.currency ?? 'USDG',
    seller: partial.seller ?? null,
    buyer: partial.buyer ?? null,
    fromAddress: partial.fromAddress ?? null,
    toAddress: partial.toAddress ?? null,
    occurredAt,
    ingestedAt: Date.now(),
    source: partial.source ?? 'stream',
  };
}

describe('applyMarketEvent', () => {
  it('lists on listing_created', () => {
    const result = applyMarketEvent(
      emptyListingRecord('635'),
      event({ type: 'listing_created', tokenId: '635', price: 666 }),
    );
    expect(result.listing.state).toBe('LISTED');
    expect(result.listing.price).toBe(666);
    expect(result.touchedListing).toBe(true);
  });

  it('force-unlist on cancel without three misses', () => {
    const listed = applyMarketEvent(
      emptyListingRecord('635'),
      event({ type: 'listing_created', tokenId: '635', price: 666 }),
    ).listing;
    const cancelled = applyMarketEvent(
      listed,
      event({ type: 'listing_cancelled', tokenId: '635', price: null }),
    );
    expect(cancelled.listing.state).toBe('UNLISTED_VERIFIED');
    expect(cancelled.listing.price).toBeNull();
  });

  it('sale clears listing', () => {
    const listed = applyMarketEvent(
      emptyListingRecord('121'),
      event({ type: 'listing_created', tokenId: '121', price: 12 }),
    ).listing;
    const sold = applyMarketEvent(
      listed,
      event({ type: 'sale', tokenId: '121', price: 12, buyer: '0xbuyer' }),
    );
    expect(sold.listing.state).toBe('UNLISTED_VERIFIED');
    expect(sold.clearListing).toBe(true);
  });
});
