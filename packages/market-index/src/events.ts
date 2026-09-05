/**
 * Normalized marketplace events for Indexer V3.
 * Stream payloads and REST collection events both map into this shape
 * before idempotent persistence + state apply.
 */

export const MARKET_EVENT_TYPES = [
  'listing_created',
  'listing_cancelled',
  'sale',
  'transfer',
  'offer_created',
  'order_invalidate',
  'order_revalidate',
  'metadata_updated',
] as const;

export type MarketEventType = (typeof MARKET_EVENT_TYPES)[number];

export type MarketEvent = {
  marketplaceEventId: string;
  type: MarketEventType;
  tokenId: string;
  orderHash: string | null;
  price: number | null;
  currency: string | null;
  seller: string | null;
  buyer: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  occurredAt: number;
  ingestedAt: number;
  source: 'stream' | 'rest-backfill' | 'auditor' | 'hot-reconcile';
  raw?: unknown;
};

/** Stable idempotency key — must survive reconnect replays. */
export function marketEventId(input: {
  type: MarketEventType;
  tokenId: string;
  orderHash?: string | null;
  tx?: string | null;
  occurredAt: number;
}): string {
  const anchor = input.orderHash || input.tx || 'none';
  return `${input.type}:${anchor}:${input.tokenId}:${input.occurredAt}`;
}
