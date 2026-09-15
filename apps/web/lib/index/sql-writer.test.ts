import { describe, expect, it, beforeEach } from 'vitest';
import {
  BUTTON_PRESSER_COLLECTION_ID,
  HELIX_ECOSYSTEM_ID,
  tokenIdentity,
} from './schema-v2';
import { canonicalSourceEventId, fromInMemoryMarketEvent, MARKET_EVENT_SOURCE } from './canonical-event';
import type { CanonicalMarketEvent } from './canonical-event';
import { MemoryMarketRepository } from './memory-market-repository';
import {
  applyCanonicalMarketEvent,
  applyReconciliationObservation,
  isEventOutOfOrder,
  resetSqlWriterMetricsForTests,
  sqlWriterMetrics,
} from './sql-writer';
import { applyObservation, emptyListingRecord } from '../market/listing-state';
import type { MarketEvent } from './market-event';

const T0 = Date.parse('2026-09-07T10:00:00Z');

function event(partial: Partial<CanonicalMarketEvent> & Pick<CanonicalMarketEvent, 'eventType' | 'tokenId'>): CanonicalMarketEvent {
  const collectionId = partial.collectionId ?? BUTTON_PRESSER_COLLECTION_ID;
  const occurredAt = partial.occurredAt ?? T0;
  const orderHash = partial.orderHash ?? null;
  const draft = {
    ecosystemId: HELIX_ECOSYSTEM_ID,
    collectionId,
    source: MARKET_EVENT_SOURCE,
    eventType: partial.eventType,
    tokenId: partial.tokenId,
    occurredAt,
    transport: partial.transport ?? 'stream',
    price: partial.price ?? null,
    currency: partial.currency ?? 'USDG',
    orderHash,
    transactionHash: partial.transactionHash ?? null,
    seller: partial.seller ?? '0x0000000000000000000000000000000000000abc',
    buyer: partial.buyer ?? null,
    ownerAddress: partial.ownerAddress ?? null,
    metadata: partial.metadata ?? null,
  };
  return {
    ...draft,
    sourceEventId:
      partial.sourceEventId ??
      canonicalSourceEventId({
        eventType: draft.eventType,
        collectionId: draft.collectionId,
        tokenId: draft.tokenId,
        orderHash: draft.orderHash,
        transactionHash: draft.transactionHash,
        occurredAt: draft.occurredAt,
        ownerAddress: draft.ownerAddress,
      }),
  };
}

describe('canonical event identity', () => {
  it('collides Stream and REST for the same OpenSea order', () => {
    const stream: MarketEvent = {
      id: 'listed:966:0xabc:1:item_listed',
      kind: 'listed',
      tokenId: '966',
      occurredAt: T0,
      source: 'stream',
      price: 540,
      currency: 'USDG',
      orderHash: '0xabc',
      seller: '0x0000000000000000000000000000000000000abc',
      buyer: null,
      ownerAddress: null,
      metadata: null,
    };
    const rest: MarketEvent = {
      ...stream,
      id: 'listed:966:0xabc:1',
      source: 'rest',
      occurredAt: T0 + 50,
    };
    const a = fromInMemoryMarketEvent(stream);
    const b = fromInMemoryMarketEvent(rest);
    expect(a.source).toBe('opensea');
    expect(a.sourceEventId).toBe(b.sourceEventId);
    expect(a.sourceEventId).toContain('LISTED');
    expect(a.transport).not.toBe(b.transport);
  });

  it('does not collide listed vs sold of the same order', () => {
    const listed = event({ eventType: 'LISTED', tokenId: 870, orderHash: '0xsale', price: 100 });
    const sold = event({ eventType: 'SOLD', tokenId: 870, orderHash: '0xsale', price: 100 });
    expect(listed.sourceEventId).not.toBe(sold.sourceEventId);
  });
});

describe('A2 event-local SQL writer', () => {
  let repo: MemoryMarketRepository;

  beforeEach(() => {
    repo = new MemoryMarketRepository();
    resetSqlWriterMetricsForTests();
  });

  it('same listing twice → one event, one projection', async () => {
    const listed = event({ eventType: 'LISTED', tokenId: 966, orderHash: '0xabc', price: 540 });
    expect(await applyCanonicalMarketEvent(repo, listed)).toBe('applied');
    expect(await applyCanonicalMarketEvent(repo, listed)).toBe('duplicate');
    expect(repo.eventCount()).toBe(1);
    const state = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 966);
    expect(state?.listingState).toBe('LISTED');
    expect(state?.price).toBe(540);
    expect(sqlWriterMetrics().marketEventDuplicates).toBe(1);
  });

  it('Stream + REST duplicate → one canonical event', async () => {
    const stream = event({
      eventType: 'LISTED',
      tokenId: 628,
      orderHash: '0xrest',
      price: 250,
      transport: 'stream',
    });
    const rest = event({
      eventType: 'LISTED',
      tokenId: 628,
      orderHash: '0xrest',
      price: 250,
      transport: 'rest',
      occurredAt: T0 + 10,
    });
    expect(stream.sourceEventId).toBe(rest.sourceEventId);
    expect(await applyCanonicalMarketEvent(repo, stream)).toBe('applied');
    expect(await applyCanonicalMarketEvent(repo, rest)).toBe('duplicate');
    expect(repo.eventCount()).toBe(1);
  });

  it('LIST → CANCEL → delayed old LIST leaves UNLISTED_VERIFIED', async () => {
    const listed = event({
      eventType: 'LISTED',
      tokenId: 966,
      orderHash: '0xfloor',
      price: 1.69,
      occurredAt: T0,
    });
    const cancelled = event({
      eventType: 'CANCELLED',
      tokenId: 966,
      orderHash: '0xfloor',
      occurredAt: T0 + 60_000,
    });
    expect(await applyCanonicalMarketEvent(repo, listed)).toBe('applied');
    expect(await applyCanonicalMarketEvent(repo, cancelled)).toBe('applied');
    expect(await applyCanonicalMarketEvent(repo, listed)).toBe('duplicate');

    const delayedClone = event({
      eventType: 'LISTED',
      tokenId: 966,
      orderHash: '0xfloor-old-delivery',
      price: 1.69,
      occurredAt: T0,
    });
    expect(await applyCanonicalMarketEvent(repo, delayedClone)).toBe('applied');
    const state = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 966);
    expect(state?.listingState).toBe('UNLISTED_VERIFIED');
    expect(state?.orderHash).toBeNull();
    expect(sqlWriterMetrics().outOfOrderEventsIgnored).toBe(1);
  });

  it('LIST A → CANCEL A → LIST B → LIST B', async () => {
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 1, orderHash: '0xa', price: 10, occurredAt: T0 }),
    );
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'CANCELLED', tokenId: 1, orderHash: '0xa', occurredAt: T0 + 1 }),
    );
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 1, orderHash: '0xb', price: 11, occurredAt: T0 + 2 }),
    );
    const state = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 1);
    expect(state?.listingState).toBe('LISTED');
    expect(state?.orderHash).toBe('0xb');
    expect(state?.price).toBe(11);
  });

  it('LIST A → LIST B → late CANCEL A leaves LIST B', async () => {
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 2, orderHash: '0xa', price: 10, occurredAt: T0 }),
    );
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 2, orderHash: '0xb', price: 12, occurredAt: T0 + 1 }),
    );
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'CANCELLED', tokenId: 2, orderHash: '0xa', occurredAt: T0 + 2 }),
    );
    const state = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 2);
    expect(state?.listingState).toBe('LISTED');
    expect(state?.orderHash).toBe('0xb');
  });

  it('LIST A → SALE A persists sale and clears the listing', async () => {
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 870, orderHash: '0xsale', price: 100, occurredAt: T0 }),
    );
    await applyCanonicalMarketEvent(
      repo,
      event({
        eventType: 'SOLD',
        tokenId: 870,
        orderHash: '0xsale',
        price: 100,
        occurredAt: T0 + 1,
        buyer: '0x0000000000000000000000000000000000000def',
        ownerAddress: '0x0000000000000000000000000000000000000def',
      }),
    );
    const state = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 870);
    expect(state?.listingState).toBe('UNLISTED_VERIFIED');
    expect(state?.orderHash).toBeNull();
    expect(repo.saleCount()).toBe(1);
    expect(repo.token(BUTTON_PRESSER_COLLECTION_ID, 870)?.ownerAddress).toBe(
      '0x0000000000000000000000000000000000000def',
    );
  });

  it('worker restart replay of the same event is a no-op', async () => {
    const listed = event({ eventType: 'LISTED', tokenId: 507, orderHash: '0x507', price: 3 });
    await applyCanonicalMarketEvent(repo, listed);
    const afterFirst = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 507);
    expect(await applyCanonicalMarketEvent(repo, listed)).toBe('duplicate');
    const afterReplay = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 507);
    expect(afterReplay).toEqual(afterFirst);
    expect(repo.eventCount()).toBe(1);
  });

  it('transaction rollback after event insert leaves no journal or state', async () => {
    const listed = event({ eventType: 'LISTED', tokenId: 756, orderHash: '0x756', price: 9 });
    await expect(
      applyCanonicalMarketEvent(repo, listed, {
        afterInsert: async () => {
          throw new Error('forced projection failure');
        },
      }),
    ).rejects.toThrow(/forced projection failure/);
    expect(repo.eventCount()).toBe(0);
    expect(await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 756)).toBeNull();
    expect(sqlWriterMetrics().eventProjectionFailures).toBe(1);
  });

  it('button-presser #68 and netnet-gear #68 do not collide', async () => {
    expect(tokenIdentity('button-presser', 68)).not.toBe(tokenIdentity('netnet-gear', 68));
    await applyCanonicalMarketEvent(
      repo,
      event({
        eventType: 'LISTED',
        tokenId: 68,
        collectionId: 'button-presser',
        orderHash: '0xbp',
        price: 1,
      }),
    );
    await applyCanonicalMarketEvent(
      repo,
      event({
        eventType: 'LISTED',
        tokenId: 68,
        collectionId: 'netnet-gear',
        orderHash: '0xgear',
        price: 50,
      }),
    );
    const bp = await repo.getTokenMarketState('button-presser', 68);
    const gear = await repo.getTokenMarketState('netnet-gear', 68);
    expect(bp?.price).toBe(1);
    expect(gear?.price).toBe(50);
    expect(repo.eventCount()).toBe(2);
  });

  it('concurrent same event: one insert, one duplicate, no corruption', async () => {
    const listed = event({ eventType: 'LISTED', tokenId: 635, orderHash: '0x635', price: 4 });
    const results = await Promise.all([
      applyCanonicalMarketEvent(repo, listed),
      applyCanonicalMarketEvent(repo, listed),
    ]);
    expect(results.sort()).toEqual(['applied', 'duplicate']);
    expect(repo.eventCount()).toBe(1);
    const state = await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 635);
    expect(state?.listingState).toBe('LISTED');
    expect(state?.price).toBe(4);
  });

  it('fresh reconciliation can unlist; stale reconciliation cannot override a newer event', async () => {
    await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 3, orderHash: '0xnow', price: 8, occurredAt: T0 + 10_000 }),
    );
    const unlisted = applyObservation(
      emptyListingRecord('3'),
      { kind: 'no-ask' },
      T0,
    );
    unlisted.state = 'UNLISTED_VERIFIED';
    const stale = await applyReconciliationObservation(repo, {
      collectionId: BUTTON_PRESSER_COLLECTION_ID,
      record: unlisted,
      verifiedAt: T0,
    });
    expect(stale).toBe('skipped_stale');
    expect((await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 3))?.listingState).toBe('LISTED');

    const freshRecord = applyObservation(
      emptyListingRecord('3'),
      { kind: 'no-ask' },
      T0 + 20_000,
    );
    const fresh = await applyReconciliationObservation(repo, {
      collectionId: BUTTON_PRESSER_COLLECTION_ID,
      record: { ...freshRecord, tokenId: '3' },
      verifiedAt: T0 + 20_000,
    });
    expect(fresh).toBe('applied');
    expect((await repo.getTokenMarketState(BUTTON_PRESSER_COLLECTION_ID, 3))?.listingState).toBe(
      'UNLISTED_VERIFIED',
    );
  });

  it('listed without a finite price is not journaled', async () => {
    const result = await applyCanonicalMarketEvent(
      repo,
      event({ eventType: 'LISTED', tokenId: 4, orderHash: '0xnoprice', price: null }),
    );
    expect(result).toBe('ignored');
    expect(repo.eventCount()).toBe(0);
  });

  it('isEventOutOfOrder is strict-less-than on state_event_at', () => {
    expect(
      isEventOutOfOrder({ stateEventAt: T0 + 1 } as never, T0),
    ).toBe(true);
    expect(isEventOutOfOrder({ stateEventAt: T0 } as never, T0)).toBe(false);
    expect(isEventOutOfOrder(null, T0)).toBe(false);
  });
});
