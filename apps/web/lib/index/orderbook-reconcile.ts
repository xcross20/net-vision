/**
 * Recovery owner: listed count vs OpenSea.
 *
 * Detection: page OpenSea collection `/best` (fallback `/all`) until the
 * cursor ends. The unique token set is the live listed set.
 * Recovery: upsert those asks as LISTED; on a *complete* snapshot,
 * demote every other LISTED/STALE (cancel) and UNKNOWN (no-ask).
 * SLA: ORDERBOOK_RECONCILE_MS.
 *
 * Incomplete pages (cursor loop, 429, page cap) still upsert asks but
 * must not unlisted — a partial book is not proof of absence.
 */
import { BUTTON_PRESSER_COLLECTION, isOfficialExistingTokenId } from '@net-vision/chain-config';
import type { OpenSeaClient, Order } from '@net-vision/opensea-client';
import { isOpenSeaRateLimited } from '../market/opensea-errors';
import { applyObservation, type ListingRecord } from '../market/listing-state';
import {
  allListingRecords,
  listingRecord,
  patchMaintenance,
  saveIndex,
  writeListing,
  writeWorkerCheckpoint,
} from './store';
import { enqueueSqlReconciliation } from './sql-writer';

export const ORDERBOOK_RECONCILE_MS = 60_000;
export const ORDERBOOK_PAGE_LIMIT = 50;
export const ORDERBOOK_MAX_PAGES = 80;

export type OrderbookAsk = {
  tokenId: string;
  price: number;
  currency: string;
  orderHash: string;
  seller: string | null;
  listedAt: number | null;
};

export type CollectionListingsPage = {
  listings: Order[];
  next?: string | null;
};

export type PageFetch = (input: {
  cursor?: string;
  limit: number;
}) => Promise<CollectionListingsPage>;

export type FetchResult = {
  complete: boolean;
  asks: Map<string, OrderbookAsk>;
  pages: number;
  reason: 'end' | 'short-page' | 'cursor-loop' | 'page-cap' | 'empty';
};

export type ApplyResult = {
  complete: boolean;
  listed: number;
  upserted: number;
  demoted: number;
  reason: FetchResult['reason'];
};

function digitId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const tokenId = String(value);
  return /^\d+$/.test(tokenId) ? tokenId : null;
}

function nftIdFromItems(
  items: Order['protocol_data']['parameters']['offer'] | undefined,
): string | null {
  if (!items) return null;
  const nft = items.find((item) => item.itemType === 2);
  return digitId(nft?.identifierOrCriteria);
}

export function askFromOrder(order: Order): OrderbookAsk | null {
  const tokenId =
    digitId(order.asset?.identifier) ??
    nftIdFromItems(order.protocol_data.parameters.offer) ??
    nftIdFromItems(order.protocol_data.parameters.consideration);
  if (!tokenId) return null;
  const n = Number(tokenId);
  if (!isOfficialExistingTokenId(n)) return null;

  const envelope = order.price as unknown;
  const current = (envelope as { current?: unknown } | null)?.current ?? envelope;
  if (!current || typeof current !== 'object') return null;
  const tuple = current as { currency?: string; decimals?: number; value?: string | number };
  if (tuple.decimals == null || tuple.value == null) return null;
  const amount = Number(tuple.value) / 10 ** tuple.decimals;
  if (!Number.isFinite(amount)) return null;

  const start = order.protocol_data.parameters.startTime;
  const listedAt =
    typeof start === 'number'
      ? start * (start < 10_000_000_000 ? 1000 : 1)
      : typeof start === 'string' && /^\d+$/.test(start)
        ? Number(start) * (Number(start) < 10_000_000_000 ? 1000 : 1)
        : null;

  return {
    tokenId,
    price: amount,
    currency: tuple.currency ?? 'USDG',
    orderHash: order.order_hash,
    seller: order.protocol_data.parameters.offerer ?? null,
    listedAt,
  };
}

function keepCheaper(asks: Map<string, OrderbookAsk>, ask: OrderbookAsk): void {
  const existing = asks.get(ask.tokenId);
  if (!existing || ask.price < existing.price) asks.set(ask.tokenId, ask);
}

export async function fetchCompleteAskSet(fetchPage: PageFetch): Promise<FetchResult> {
  const asks = new Map<string, OrderbookAsk>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;

  while (pages < ORDERBOOK_MAX_PAGES) {
    const page = await fetchPage({ cursor, limit: ORDERBOOK_PAGE_LIMIT });
    pages += 1;
    for (const order of page.listings) {
      const ask = askFromOrder(order);
      if (ask) keepCheaper(asks, ask);
    }

    const next = page.next?.trim() ? page.next : null;
    if (!next) {
      return {
        complete: true,
        asks,
        pages,
        reason: page.listings.length === 0 && asks.size === 0 ? 'empty' : 'end',
      };
    }
    if (seenCursors.has(next) || next === cursor) {
      const short = page.listings.length < ORDERBOOK_PAGE_LIMIT;
      return {
        complete: short,
        asks,
        pages,
        reason: short ? 'short-page' : 'cursor-loop',
      };
    }
    if (page.listings.length < ORDERBOOK_PAGE_LIMIT) {
      return { complete: true, asks, pages, reason: 'short-page' };
    }
    seenCursors.add(next);
    cursor = next;
  }

  return { complete: false, asks, pages, reason: 'page-cap' };
}

export async function fetchOpenSeaAskSet(client: OpenSeaClient): Promise<FetchResult> {
  const slug = BUTTON_PRESSER_COLLECTION.openseaSlug;
  const best = await fetchCompleteAskSet((input) =>
    client.getCollectionBestListings({
      slug,
      cursor: input.cursor,
      limit: input.limit,
    }),
  );
  if (best.complete) return best;

  const all = await fetchCompleteAskSet((input) =>
    client.getCollectionListings({
      slug,
      cursor: input.cursor,
      limit: input.limit,
    }),
  );
  if (all.complete) return all;

  const merged = new Map(best.asks);
  for (const ask of all.asks.values()) keepCheaper(merged, ask);
  return {
    complete: false,
    asks: merged,
    pages: best.pages + all.pages,
    reason: 'cursor-loop',
  };
}

function recordsEqual(a: ListingRecord, b: ListingRecord): boolean {
  return (
    a.state === b.state &&
    a.price === b.price &&
    a.orderHash === b.orderHash &&
    a.currency === b.currency
  );
}

function persist(next: ListingRecord, now: number): boolean {
  const prev = listingRecord(next.tokenId);
  if (recordsEqual(prev, next)) return false;
  writeListing(next);
  enqueueSqlReconciliation(next, now);
  return true;
}

export function applyFetchedAskSet(fetched: FetchResult, now = Date.now()): ApplyResult {
  let upserted = 0;
  for (const ask of fetched.asks.values()) {
    const next = applyObservation(
      listingRecord(ask.tokenId),
      {
        kind: 'ask',
        price: ask.price,
        currency: ask.currency,
        orderHash: ask.orderHash,
        seller: ask.seller,
        listedAt: ask.listedAt,
      },
      now,
    );
    if (persist(next, now)) upserted += 1;
  }

  let demoted = 0;
  if (fetched.complete) {
    const live = fetched.asks;
    for (const row of allListingRecords()) {
      if (live.has(row.tokenId)) continue;
      if (row.state === 'UNLISTED_VERIFIED') continue;
      if (row.state !== 'LISTED' && row.state !== 'STALE' && row.state !== 'UNKNOWN') continue;
      const observation =
        row.state === 'UNKNOWN'
          ? ({ kind: 'no-ask' } as const)
          : ({ kind: 'cancel', orderHash: null } as const);
      const next = applyObservation(row, observation, now);
      if (persist(next, now)) demoted += 1;
    }
  }

  const listed = fetched.asks.size;
  patchMaintenance({
    orderbookListedCount: listed,
    orderbookSyncedAt: now,
    orderbookComplete: fetched.complete,
    lastError: fetched.complete ? null : `orderbook incomplete: ${fetched.reason}`,
  });
  writeWorkerCheckpoint({
    lastSuccessAt: now,
    lastError: fetched.complete ? null : `orderbook incomplete: ${fetched.reason}`,
  });
  saveIndex();

  return {
    complete: fetched.complete,
    listed,
    upserted,
    demoted,
    reason: fetched.reason,
  };
}

export async function runOrderbookReconcileOnce(client: OpenSeaClient): Promise<ApplyResult> {
  const fetched = await fetchOpenSeaAskSet(client);
  return applyFetchedAskSet(fetched);
}

export function startOrderbookReconcile(client: OpenSeaClient): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const result = await runOrderbookReconcileOnce(client);
      console.log(
        '[orderbook-reconcile]',
        `complete=${result.complete}`,
        `listed=${result.listed}`,
        `upserted=${result.upserted}`,
        `demoted=${result.demoted}`,
        `reason=${result.reason}`,
      );
    } catch (err) {
      if (isOpenSeaRateLimited(err)) {
        patchMaintenance({ lastError: '429' });
        writeWorkerCheckpoint({ last429At: Date.now(), lastError: '429' });
        saveIndex();
        if (!stopped) setTimeout(() => void tick(), 5 * 60_000);
        return;
      }
      patchMaintenance({
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
    if (!stopped) setTimeout(() => void tick(), ORDERBOOK_RECONCILE_MS);
  };
  void tick();
  return () => {
    stopped = true;
  };
}
