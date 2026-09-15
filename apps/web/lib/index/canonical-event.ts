/**
 * Transport-independent OpenSea event identity for A2 SQL ingest.
 * Stream vs REST vs retry must collide on the same source_event_id.
 */
import {
  BUTTON_PRESSER_COLLECTION_ID,
  HELIX_ECOSYSTEM_ID,
} from './schema-v2';
import type { MarketEvent, MarketEventKind } from './market-event';

export const MARKET_EVENT_SOURCE = 'opensea' as const;

export type CanonicalEventType =
  | 'LISTED'
  | 'CANCELLED'
  | 'SOLD'
  | 'TRANSFERRED'
  | 'METADATA_UPDATED'
  | 'ORDER_INVALIDATED'
  | 'ORDER_REVALIDATED';

export type CanonicalMarketEvent = {
  ecosystemId: string;
  collectionId: string;
  source: typeof MARKET_EVENT_SOURCE;
  sourceEventId: string;
  eventType: CanonicalEventType;
  tokenId: number;
  occurredAt: number;
  transport: 'stream' | 'rest';
  price: number | null;
  currency: string | null;
  orderHash: string | null;
  transactionHash: string | null;
  seller: string | null;
  buyer: string | null;
  ownerAddress: string | null;
  metadata: MarketEvent['metadata'];
};

const KIND_TO_TYPE: Record<MarketEventKind, CanonicalEventType> = {
  listed: 'LISTED',
  cancelled: 'CANCELLED',
  sold: 'SOLD',
  transferred: 'TRANSFERRED',
  metadata: 'METADATA_UPDATED',
};

export function canonicalEventType(kind: MarketEventKind): CanonicalEventType {
  return KIND_TO_TYPE[kind];
}

export function canonicalSourceEventId(input: {
  eventType: CanonicalEventType;
  collectionId: string;
  tokenId: number;
  orderHash: string | null;
  transactionHash?: string | null;
  occurredAt: number;
  ownerAddress?: string | null;
}): string {
  const { eventType, collectionId, tokenId } = input;
  if (eventType === 'LISTED' || eventType === 'CANCELLED' || eventType === 'SOLD' || eventType === 'ORDER_INVALIDATED' || eventType === 'ORDER_REVALIDATED') {
    const disc = input.orderHash || input.transactionHash || String(input.occurredAt);
    return `${eventType}:${collectionId}:${tokenId}:${disc}`;
  }
  if (eventType === 'TRANSFERRED') {
    const disc = input.transactionHash || `${input.occurredAt}:${input.ownerAddress ?? ''}`;
    return `${eventType}:${collectionId}:${tokenId}:${disc}`;
  }
  return `${eventType}:${collectionId}:${tokenId}:${input.occurredAt}`;
}

export function fromInMemoryMarketEvent(
  event: MarketEvent,
  collectionId = BUTTON_PRESSER_COLLECTION_ID,
): CanonicalMarketEvent {
  const tokenId = Number(event.tokenId);
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    throw new Error(`fromInMemoryMarketEvent: invalid tokenId ${event.tokenId}`);
  }
  const eventType = canonicalEventType(event.kind);
  return {
    ecosystemId: HELIX_ECOSYSTEM_ID,
    collectionId,
    source: MARKET_EVENT_SOURCE,
    sourceEventId: canonicalSourceEventId({
      eventType,
      collectionId,
      tokenId,
      orderHash: event.orderHash,
      occurredAt: event.occurredAt,
      ownerAddress: event.ownerAddress,
    }),
    eventType,
    tokenId,
    occurredAt: event.occurredAt,
    transport: event.source,
    price: event.price,
    currency: event.currency,
    orderHash: event.orderHash,
    transactionHash: null,
    seller: event.seller,
    buyer: event.buyer,
    ownerAddress: event.ownerAddress,
    metadata: event.metadata,
  };
}

export function isPersistableListed(event: CanonicalMarketEvent): boolean {
  if (event.eventType !== 'LISTED' && event.eventType !== 'ORDER_REVALIDATED') return true;
  return event.price != null && Number.isFinite(event.price);
}
