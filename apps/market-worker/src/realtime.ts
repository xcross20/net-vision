/**
 * Realtime primary loop: prefer OpenSea Stream; fall back to REST events poll
 * when Stream is silent (Robinhood spike outcome).
 */
import { OpenSeaStreamClient, EventType } from '@opensea/sdk/stream';
import {
  applyMarketEvent,
  emptyListingRecord,
  insertMarketEvent,
  marketEventId,
  readListing,
  upsertListing,
  upsertStreamCheckpoint,
  type MarketEvent,
  type MarketEventType,
} from '@net-vision/market-index';
import { createOpenSeaClient } from '@net-vision/opensea-client';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';

const STREAM_ID = 'button-presser';
const REST_POLL_MS = Number(process.env.REST_EVENTS_POLL_MS ?? 20_000);
const STREAM_SILENCE_MS = Number(process.env.STREAM_SILENCE_FALLBACK_MS ?? 120_000);

export type RealtimeMode = 'stream' | 'rest-events';

function parseNftId(nftId: string | undefined): string | null {
  if (!nftId) return null;
  // ethereum/0xabc.../1234 or robinhood/0x.../635
  const parts = nftId.split('/');
  const tokenId = parts[parts.length - 1];
  return tokenId && /^\d+$/.test(tokenId) ? tokenId : null;
}

function priceFromPayload(payload: Record<string, unknown>): {
  price: number | null;
  currency: string | null;
} {
  const payment = payload.payment_token as { symbol?: string; decimals?: number } | undefined;
  const raw =
    (payload.base_price as string | undefined) ??
    (payload.sale_price as string | undefined) ??
    null;
  if (raw == null) return { price: null, currency: payment?.symbol ?? null };
  const decimals = payment?.decimals ?? 18;
  const price = Number(raw) / 10 ** decimals;
  return {
    price: Number.isFinite(price) ? price : null,
    currency: payment?.symbol ?? 'USDG',
  };
}

function mapStreamType(eventType: string): MarketEventType | null {
  switch (eventType) {
    case 'item_listed':
      return 'listing_created';
    case 'item_cancelled':
      return 'listing_cancelled';
    case 'item_sold':
      return 'sale';
    case 'item_transferred':
      return 'transfer';
    case 'item_metadata_updated':
      return 'metadata_updated';
    case 'order_invalidate':
      return 'order_invalidate';
    case 'order_revalidate':
      return 'order_revalidate';
    case 'item_received_bid':
      return 'offer_created';
    default:
      return null;
  }
}

async function persistAndApply(event: MarketEvent): Promise<void> {
  const inserted = await insertMarketEvent(event);
  if (!inserted) return;
  if (event.type === 'metadata_updated') {
    // Metadata apply is handled by bootstrap / dedicated fetch in a later slice.
    return;
  }
  const current = await readListing(event.tokenId);
  const result = applyMarketEvent(current ?? emptyListingRecord(event.tokenId), event);
  if (result.touchedListing) {
    await upsertListing(result.listing);
  }
  await upsertStreamCheckpoint(STREAM_ID, {
    lastEventAt: event.occurredAt,
    eventsIngestedDelta: 1,
    lastError: null,
  });
}

function streamEventToMarketEvent(raw: {
  event_type?: string;
  sent_at?: string;
  payload?: Record<string, unknown>;
}): MarketEvent | null {
  const type = mapStreamType(raw.event_type ?? '');
  if (!type) return null;
  const payload = raw.payload ?? {};
  const item = payload.item as { nft_id?: string } | undefined;
  const tokenId = parseNftId(item?.nft_id);
  if (!tokenId) return null;
  const occurredAt = Date.parse(String(payload.event_timestamp ?? raw.sent_at ?? Date.now()));
  const { price, currency } = priceFromPayload(payload);
  const maker = payload.maker as { address?: string } | undefined;
  const taker = payload.taker as { address?: string } | undefined;
  const orderHash = (payload.order_hash as string | undefined) ?? null;
  return {
    marketplaceEventId: marketEventId({
      type,
      tokenId,
      orderHash,
      tx: (payload.transaction as { hash?: string } | undefined)?.hash,
      occurredAt,
    }),
    type,
    tokenId,
    orderHash,
    price,
    currency,
    seller: maker?.address?.toLowerCase() ?? null,
    buyer: taker?.address?.toLowerCase() ?? null,
    fromAddress: (payload.from_account as { address?: string } | undefined)?.address ?? null,
    toAddress: (payload.to_account as { address?: string } | undefined)?.address ?? null,
    occurredAt,
    ingestedAt: Date.now(),
    source: 'stream',
    raw,
  };
}

export async function startStreamOrRestPrimary(options: {
  workerId: string;
  collectionSlug: string;
}): Promise<RealtimeMode> {
  const apiKey = process.env.OPENSEA_API_KEY!.trim();
  let lastStreamEventAt = 0;
  let streamAlive = false;

  try {
    const client = new OpenSeaStreamClient({ apiKey });
    client.onEvents(
      options.collectionSlug,
      [
        EventType.ITEM_LISTED,
        EventType.ITEM_SOLD,
        EventType.ITEM_CANCELLED,
        EventType.ITEM_TRANSFERRED,
        EventType.ITEM_METADATA_UPDATED,
        EventType.ORDER_INVALIDATE,
        EventType.ORDER_REVALIDATE,
      ],
      (raw) => {
        streamAlive = true;
        lastStreamEventAt = Date.now();
        const event = streamEventToMarketEvent(raw as Parameters<typeof streamEventToMarketEvent>[0]);
        if (!event) return;
        void persistAndApply(event).catch((err) => {
          console.error('[market-worker] stream apply failed', err);
        });
      },
    );
    await upsertStreamCheckpoint(STREAM_ID, { lastConnectedAt: Date.now(), lastError: null });
    console.log('[market-worker] Stream client subscribed to', options.collectionSlug);
  } catch (err) {
    console.error('[market-worker] Stream client failed to start', err);
  }

  // REST events poll — always on as gap-fill; becomes primary if Stream stays silent.
  const os = createOpenSeaClient({ OPENSEA_API_KEY: apiKey });
  const poll = async () => {
    try {
      const page = await os.getCollectionEvents({
        slug: options.collectionSlug,
        eventType: 'sale',
        limit: 50,
      });
      const events = page.asset_events ?? page.events ?? [];
      for (const row of events) {
        const tokenId = String(
          (row as { nft?: { identifier?: string } }).nft?.identifier ?? '',
        );
        if (!/^\d+$/.test(tokenId)) continue;
        const occurredAt = Date.parse(String(row.event_timestamp ?? Date.now()));
        const payment = (row as { payment?: { quantity?: string; decimals?: number; symbol?: string } })
          .payment;
        const price =
          payment?.quantity != null && payment.decimals != null
            ? Number(payment.quantity) / 10 ** payment.decimals
            : null;
        const event: MarketEvent = {
          marketplaceEventId: marketEventId({
            type: 'sale',
            tokenId,
            orderHash: (row as { order_hash?: string }).order_hash,
            tx: (row as { transaction?: string }).transaction,
            occurredAt,
          }),
          type: 'sale',
          tokenId,
          orderHash: (row as { order_hash?: string }).order_hash ?? null,
          price,
          currency: payment?.symbol ?? 'USDG',
          seller: null,
          buyer: null,
          fromAddress: null,
          toAddress: null,
          occurredAt,
          ingestedAt: Date.now(),
          source: 'rest-backfill',
          raw: row,
        };
        await persistAndApply(event);
      }
    } catch (err) {
      console.error('[market-worker] REST events poll failed', err);
    }
  };
  void poll();
  setInterval(() => void poll(), REST_POLL_MS).unref();

  // After silence window, log which mode is primary (Stream may still be connected).
  await new Promise((r) => setTimeout(r, Math.min(STREAM_SILENCE_MS, 5_000)));
  if (streamAlive || lastStreamEventAt > 0) return 'stream';
  // Keep listening; report rest-events as operational primary until first Stream event.
  void BUTTON_PRESSER_COLLECTION;
  return 'rest-events';
}
