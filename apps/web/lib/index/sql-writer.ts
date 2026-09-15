/**
 * A2 event-local SQL authority writer.
 * Dual-writes beside the blob path. Does not serve request-path reads.
 */
import { CURRENT_TAXONOMY_VERSION, facetsForToken } from '@net-vision/taxonomy';
import { attributeSale, saleEventId } from '../market/engine';
import {
  applyObservation,
  emptyListingRecord,
  type ListingObservation,
  type ListingRecord,
} from '../market/listing-state';
import type { CatalogSale } from '../market/catalog';
import {
  fromInMemoryMarketEvent,
  isPersistableListed,
  type CanonicalMarketEvent,
} from './canonical-event';
import type { MarketEvent } from './market-event';
import type { MarketRepository, SqlTokenMarketState } from './market-repository';
import { PgMarketRepository } from './market-repository';
import { ensureSchema, getPool } from './pg';
import { BUTTON_PRESSER_COLLECTION_ID } from './schema-v2';
import { sqlWriterEnabled } from './sql-writer-flags';

export { sqlWriterEnabled, destructiveNormalizedRebuildEnabled } from './sql-writer-flags';

export type SqlApplyResult =
  | 'applied'
  | 'duplicate'
  | 'ignored'
  | 'ignored_out_of_order';

const LATENCY_WINDOW = 256;

const metrics = {
  inserts: 0,
  duplicates: 0,
  ignoredOutOfOrder: 0,
  projectionFailures: 0,
  reconciliationOverrides: 0,
  reconciliationSkipped: 0,
  latenciesMs: [] as number[],
};

export function resetSqlWriterMetricsForTests(): void {
  metrics.inserts = 0;
  metrics.duplicates = 0;
  metrics.ignoredOutOfOrder = 0;
  metrics.projectionFailures = 0;
  metrics.reconciliationOverrides = 0;
  metrics.reconciliationSkipped = 0;
  metrics.latenciesMs = [];
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? null;
}

export function sqlWriterMetrics(): {
  marketEventInserts: number;
  marketEventDuplicates: number;
  outOfOrderEventsIgnored: number;
  eventProjectionFailures: number;
  reconciliationOverrides: number;
  reconciliationSkipped: number;
  sqlWriteLatencyP50Ms: number | null;
  sqlWriteLatencyP95Ms: number | null;
} {
  const sorted = [...metrics.latenciesMs].sort((a, b) => a - b);
  return {
    marketEventInserts: metrics.inserts,
    marketEventDuplicates: metrics.duplicates,
    outOfOrderEventsIgnored: metrics.ignoredOutOfOrder,
    eventProjectionFailures: metrics.projectionFailures,
    reconciliationOverrides: metrics.reconciliationOverrides,
    reconciliationSkipped: metrics.reconciliationSkipped,
    sqlWriteLatencyP50Ms: percentile(sorted, 50),
    sqlWriteLatencyP95Ms: percentile(sorted, 95),
  };
}

function recordLatency(startedAt: number): void {
  metrics.latenciesMs.push(Date.now() - startedAt);
  if (metrics.latenciesMs.length > LATENCY_WINDOW) metrics.latenciesMs.shift();
}

function listingFromSql(row: SqlTokenMarketState | null, tokenId: string): ListingRecord {
  if (!row) return emptyListingRecord(tokenId);
  return {
    tokenId,
    state: row.listingState,
    price: row.price,
    currency: row.currency,
    orderHash: row.orderHash,
    seller: row.seller,
    listedAt: row.listedAt,
    lastVerifiedAt: row.lastVerifiedAt,
    consecutive404s: row.consecutive404s,
  };
}

function sqlFromListing(
  collectionId: string,
  record: ListingRecord,
  ordering: { stateEventAt: number | null; stateEventId: string | null; stateSource: string | null },
): SqlTokenMarketState {
  return {
    collectionId,
    tokenId: Number(record.tokenId),
    listingState: record.state,
    orderHash: record.orderHash,
    price: record.price,
    currency: record.currency,
    seller: record.seller,
    listedAt: record.listedAt,
    lastVerifiedAt: record.lastVerifiedAt,
    consecutive404s: record.consecutive404s,
    stateEventAt: ordering.stateEventAt,
    stateEventId: ordering.stateEventId,
    stateSource: ordering.stateSource,
  };
}

export function isEventOutOfOrder(
  current: SqlTokenMarketState | null,
  occurredAt: number,
): boolean {
  if (current?.stateEventAt == null) return false;
  return occurredAt < current.stateEventAt;
}

async function ensureTokenRow(repo: MarketRepository, event: CanonicalMarketEvent): Promise<void> {
  await repo.upsertToken({
    collectionId: event.collectionId,
    tokenId: event.tokenId,
    displayNumber: String(event.tokenId),
    exists: true,
    ownerAddress: event.ownerAddress,
    name: event.metadata?.name ?? null,
    imageUrl: event.metadata?.imageUrl ?? null,
    metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
    metadataVerifiedAt: event.eventType === 'METADATA_UPDATED' ? event.occurredAt : null,
    lastSeenAt: event.occurredAt,
  });
}

async function projectEvent(repo: MarketRepository, event: CanonicalMarketEvent): Promise<void> {
  await ensureTokenRow(repo, event);
  const current = await repo.getTokenMarketState(event.collectionId, event.tokenId);
  const tokenId = String(event.tokenId);

  if (event.eventType === 'METADATA_UPDATED') {
    const facets = facetsForToken(tokenId, {
      traits: event.metadata?.traits,
      name: event.metadata?.name,
    });
    await repo.replaceTokenFacetsForToken(
      event.collectionId,
      event.tokenId,
      facets,
      `taxonomy-${CURRENT_TAXONOMY_VERSION}`,
    );
    return;
  }

  if (event.eventType === 'TRANSFERRED') {
    return;
  }

  if (event.eventType === 'SOLD' && event.price != null && Number.isFinite(event.price)) {
    const sale: CatalogSale = {
      tokenId,
      price: event.price,
      currency: event.currency ?? 'USDG',
      occurredAt: event.occurredAt,
      orderHash: event.orderHash,
      buyer: event.buyer,
      seller: event.seller,
    };
    await repo.insertSale({
      collectionId: event.collectionId,
      saleEventId: saleEventId(sale),
      tokenId: event.tokenId,
      price: sale.price,
      currency: sale.currency,
      occurredAt: sale.occurredAt,
      orderHash: sale.orderHash,
      buyer: sale.buyer,
      seller: sale.seller,
    });
    const facets = facetsForToken(tokenId);
    const attributions = attributeSale(sale, facets);
    await repo.insertSaleAttributions(
      attributions.map((row) => ({
        collectionId: event.collectionId,
        saleEventId: row.saleEventId,
        tokenId: event.tokenId,
        categorySlug: row.categorySlug,
        taxonomyVersion: row.taxonomyVersion,
        facetSource: row.facetSource,
        attributedPrice: row.attributedPrice,
        occurredAt: row.occurredAt,
      })),
    );
  }

  if (isEventOutOfOrder(current, event.occurredAt)) {
    metrics.ignoredOutOfOrder += 1;
    return;
  }

  let observation: ListingObservation | null = null;
  if (event.eventType === 'LISTED' || event.eventType === 'ORDER_REVALIDATED') {
    if (event.price == null || !Number.isFinite(event.price)) return;
    observation = {
      kind: 'ask',
      price: event.price,
      currency: event.currency ?? 'USDG',
      orderHash: event.orderHash,
      seller: event.seller,
      listedAt: event.occurredAt,
    };
  } else if (
    event.eventType === 'CANCELLED' ||
    event.eventType === 'ORDER_INVALIDATED' ||
    event.eventType === 'SOLD'
  ) {
    observation = { kind: 'cancel', orderHash: event.orderHash };
  }

  if (!observation) return;

  const next = applyObservation(listingFromSql(current, tokenId), observation, event.occurredAt);
  await repo.upsertTokenMarketState(
    sqlFromListing(event.collectionId, next, {
      stateEventAt: event.occurredAt,
      stateEventId: event.sourceEventId,
      stateSource: 'opensea',
    }),
  );
}

export async function applyCanonicalMarketEvent(
  repo: MarketRepository,
  event: CanonicalMarketEvent,
  hooks?: { afterInsert?: () => Promise<void> },
): Promise<SqlApplyResult> {
  if (!isPersistableListed(event)) return 'ignored';
  const startedAt = Date.now();
  try {
    const result = await repo.withTransaction(async (tx) => {
      const inserted = await tx.insertMarketEvent(event);
      if (inserted === 'duplicate') return 'duplicate' as const;
      if (hooks?.afterInsert) await hooks.afterInsert();
      await projectEvent(tx, event);
      return 'applied' as const;
    });
    recordLatency(startedAt);
    if (result === 'duplicate') metrics.duplicates += 1;
    else metrics.inserts += 1;
    return result;
  } catch (err) {
    metrics.projectionFailures += 1;
    throw err;
  }
}

export async function applyReconciliationObservation(
  repo: MarketRepository,
  input: {
    collectionId: string;
    record: ListingRecord;
    verifiedAt: number;
  },
): Promise<'applied' | 'skipped_stale'> {
  const tokenId = Number(input.record.tokenId);
  return repo.withTransaction(async (tx) => {
    await tx.upsertToken({
      collectionId: input.collectionId,
      tokenId,
      displayNumber: input.record.tokenId,
      exists: true,
      ownerAddress: input.record.seller,
      name: null,
      imageUrl: null,
      metadataJson: null,
      metadataVerifiedAt: null,
      lastSeenAt: input.verifiedAt,
    });
    const current = await tx.getTokenMarketState(input.collectionId, tokenId);
    if (current?.stateEventAt != null && input.verifiedAt < current.stateEventAt) {
      metrics.reconciliationSkipped += 1;
      return 'skipped_stale';
    }
    await tx.upsertTokenMarketState(
      sqlFromListing(input.collectionId, input.record, {
        // High-water so a delayed older event cannot resurrect pre-recon state.
        stateEventAt: input.verifiedAt,
        stateEventId: current?.stateEventId ?? null,
        stateSource: 'reconciliation',
      }),
    );
    metrics.reconciliationOverrides += 1;
    return 'applied';
  });
}

const persistChains = new Map<string, Promise<void>>();

function enqueue(key: string, work: () => Promise<void>): void {
  const next = (persistChains.get(key) ?? Promise.resolve())
    .then(work)
    .catch((err) => {
      metrics.projectionFailures += 1;
      console.error('[sql-writer]', err instanceof Error ? err.message : err);
    });
  persistChains.set(key, next);
}

async function liveRepo(): Promise<MarketRepository | null> {
  if (!sqlWriterEnabled()) return null;
  const pool = getPool();
  if (!pool) return null;
  await ensureSchema();
  return new PgMarketRepository(pool);
}

export function enqueueSqlMarketEvent(event: MarketEvent): void {
  if (!sqlWriterEnabled()) return;
  let canonical: CanonicalMarketEvent;
  try {
    canonical = fromInMemoryMarketEvent(event);
  } catch {
    return;
  }
  const key = `${canonical.collectionId}:${canonical.tokenId}`;
  enqueue(key, async () => {
    const repo = await liveRepo();
    if (!repo) return;
    await applyCanonicalMarketEvent(repo, canonical);
  });
}

export function enqueueSqlReconciliation(record: ListingRecord, verifiedAt = Date.now()): void {
  if (!sqlWriterEnabled()) return;
  const key = `${BUTTON_PRESSER_COLLECTION_ID}:${record.tokenId}`;
  enqueue(key, async () => {
    const repo = await liveRepo();
    if (!repo) return;
    await applyReconciliationObservation(repo, {
      collectionId: BUTTON_PRESSER_COLLECTION_ID,
      record,
      verifiedAt,
    });
  });
}

export function enqueueSqlMetadataFacets(
  tokenId: string,
  nft: {
    name?: string | null;
    imageUrl?: string | null;
    ownerAddress?: string | null;
    traits?: Array<{ trait_type?: string; value?: string | number }>;
  },
): void {
  if (!sqlWriterEnabled()) return;
  const n = Number(tokenId);
  if (!Number.isInteger(n) || n < 0) return;
  const key = `${BUTTON_PRESSER_COLLECTION_ID}:${n}:meta`;
  enqueue(key, async () => {
    const repo = await liveRepo();
    if (!repo) return;
    const facets = facetsForToken(tokenId, { traits: nft.traits, name: nft.name });
    await repo.withTransaction(async (tx) => {
      await tx.upsertToken({
        collectionId: BUTTON_PRESSER_COLLECTION_ID,
        tokenId: n,
        displayNumber: tokenId,
        exists: true,
        ownerAddress: nft.ownerAddress ?? null,
        name: nft.name ?? null,
        imageUrl: nft.imageUrl ?? null,
        metadataJson: JSON.stringify({ traits: nft.traits ?? [], name: nft.name ?? null }),
        metadataVerifiedAt: Date.now(),
        lastSeenAt: Date.now(),
      });
      await tx.replaceTokenFacetsForToken(
        BUTTON_PRESSER_COLLECTION_ID,
        n,
        facets,
        `taxonomy-${CURRENT_TAXONOMY_VERSION}`,
      );
    });
  });
}
