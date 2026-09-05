/**
 * Normalized marketplace events from OpenSea Stream or REST collection events.
 * Token-local: never walk 1..62095 to apply one listing/sale/cancel.
 */
import type { AssetEvent } from '@net-vision/opensea-client';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';

export type MarketEventKind = 'listed' | 'sold' | 'cancelled' | 'transferred' | 'metadata';
export type MarketEventSource = 'stream' | 'rest';

export type MarketEvent = {
  id: string;
  kind: MarketEventKind;
  tokenId: string;
  occurredAt: number;
  source: MarketEventSource;
  price: number | null;
  currency: string | null;
  orderHash: string | null;
  seller: string | null;
  buyer: string | null;
  ownerAddress: string | null;
  metadata: {
    name?: string | null;
    imageUrl?: string | null;
    traits?: Array<{ trait_type?: string; value?: string | number }>;
  } | null;
};

const TOKEN_ID_RE = /^\d+$/;
const WINDOW_15M_MS = 15 * 60_000;

export function isButtonPresserTokenId(tokenId: string): boolean {
  if (!TOKEN_ID_RE.test(tokenId)) return false;
  const n = Number(tokenId);
  return n >= BUTTON_PRESSER_COLLECTION.minTokenId && n <= BUTTON_PRESSER_COLLECTION.maxTokenId;
}

export function tokenIdFromNftId(nftId: string | null | undefined): string | null {
  if (!nftId) return null;
  const last = nftId.split('/').pop()?.trim() ?? '';
  return isButtonPresserTokenId(last) ? last : null;
}

function parseEpoch(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 0) {
      return asNum > 1e12 ? asNum : asNum * 1000;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function addressOf(value: unknown): string | null {
  if (typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)) return value.toLowerCase();
  if (value && typeof value === 'object' && 'address' in value) {
    return addressOf((value as { address?: unknown }).address);
  }
  return null;
}

function priceFromQuantity(quantity: unknown, decimals: unknown, fallback?: unknown): number | null {
  const raw = quantity ?? fallback;
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  const d = typeof decimals === 'number' ? decimals : Number(decimals ?? 0);
  if (!Number.isFinite(n) || !Number.isFinite(d)) return null;
  const amount = n / 10 ** d;
  return Number.isFinite(amount) ? amount : null;
}

const REST_KIND: Record<string, MarketEventKind> = {
  listing: 'listed',
  item_listed: 'listed',
  sale: 'sold',
  item_sold: 'sold',
  transfer: 'transferred',
  item_transferred: 'transferred',
  cancel: 'cancelled',
  cancelled: 'cancelled',
  item_cancelled: 'cancelled',
  metadata: 'metadata',
  item_metadata_updated: 'metadata',
};

function restKind(event: AssetEvent): MarketEventKind | null {
  const rawType = (event.event_type ?? '').toLowerCase();
  if (REST_KIND[rawType]) return REST_KIND[rawType];
  const orderType = (event.order_type ?? '').toLowerCase();
  if (rawType === 'order') {
    if (orderType === 'listing' || orderType.includes('listing')) return 'listed';
    // item_offer / collection_offer / trait_offer are bids — not listing state.
    return null;
  }
  return null;
}

export function restEventToMarketEvent(event: AssetEvent, now = Date.now()): MarketEvent | null {
  const kind = restKind(event);
  if (!kind) return null;
  const tokenId = String(event.nft?.identifier ?? event.asset?.identifier ?? '');
  if (!isButtonPresserTokenId(tokenId)) return null;
  const occurredAt = parseEpoch(event.event_timestamp ?? event.closing_date) ?? now;
  const orderHash = event.order_hash ?? null;
  const tx =
    typeof event.transaction === 'string'
      ? event.transaction
      : event.transaction && typeof event.transaction === 'object'
        ? (event.transaction.hash ?? null)
        : null;
  const id = [kind, tokenId, orderHash ?? tx ?? '', occurredAt].join(':');
  return {
    id,
    kind,
    tokenId,
    occurredAt,
    source: 'rest',
    price: priceFromQuantity(event.payment?.quantity, event.payment?.decimals),
    currency: event.payment?.symbol ?? event.payment?.currency ?? null,
    orderHash,
    seller: addressOf(event.seller) ?? addressOf(event.from_address),
    buyer: addressOf(event.buyer) ?? addressOf(event.to_address),
    ownerAddress: addressOf(event.to_address) ?? addressOf(event.buyer),
    metadata: null,
  };
}

type StreamMessage = {
  event_type?: string;
  sent_at?: string;
  payload?: Record<string, unknown>;
};

function streamKind(eventType: string | undefined): MarketEventKind | null {
  switch ((eventType ?? '').toLowerCase()) {
    case 'item_listed':
      return 'listed';
    case 'item_sold':
      return 'sold';
    case 'item_cancelled':
    case 'order_invalidate':
    case 'order_invalidated':
      return 'cancelled';
    case 'item_transferred':
      return 'transferred';
    case 'item_metadata_updated':
      return 'metadata';
    default:
      return null;
  }
}

export function streamMessageToMarketEvent(raw: unknown, now = Date.now()): MarketEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const msg = raw as StreamMessage;
  const kind = streamKind(msg.event_type);
  if (!kind) return null;
  const payload = (msg.payload ?? {}) as Record<string, unknown>;
  const item = (payload.item ?? {}) as Record<string, unknown>;
  const nftId = typeof item.nft_id === 'string' ? item.nft_id : null;
  const tokenId = tokenIdFromNftId(nftId);
  if (!tokenId) return null;
  const payment = (payload.payment_token ?? {}) as Record<string, unknown>;
  const orderHash =
    typeof payload.order_hash === 'string'
      ? payload.order_hash
      : typeof payload.orderHash === 'string'
        ? payload.orderHash
        : null;
  const occurredAt = parseEpoch(payload.event_timestamp ?? msg.sent_at) ?? now;
  const id = [kind, tokenId, orderHash ?? '', occurredAt, msg.event_type ?? ''].join(':');
  const meta = (item.metadata ?? {}) as Record<string, unknown>;
  const traits = Array.isArray(meta.traits)
    ? (meta.traits as Array<{ trait_type?: string; value?: string | number }>)
    : undefined;
  return {
    id,
    kind,
    tokenId,
    occurredAt,
    source: 'stream',
    price: priceFromQuantity(payload.base_price ?? payload.sale_price, payment.decimals ?? 18),
    currency: typeof payment.symbol === 'string' ? payment.symbol : null,
    orderHash,
    seller: addressOf(payload.maker) ?? addressOf(payload.from_account) ?? addressOf(payload.seller),
    buyer: addressOf(payload.taker) ?? addressOf(payload.to_account) ?? addressOf(payload.buyer),
    ownerAddress: addressOf(payload.to_account) ?? addressOf(payload.taker),
    metadata:
      kind === 'metadata'
        ? {
            name: typeof meta.name === 'string' ? meta.name : null,
            imageUrl: typeof meta.image_url === 'string' ? meta.image_url : null,
            traits,
          }
        : null,
  };
}

export function eventsInWindow(timestamps: number[], now = Date.now(), windowMs = WINDOW_15M_MS): number {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t >= cutoff).length;
}
