/**
 * Market index store. Schema matches docs/data/MARKET_INDEXER_V2.md.
 *
 * When DATABASE_URL is set, Postgres is authoritative (see hydrateIndexFromPostgres).
 * JSON on disk is a local/dev cache and dual-write companion — not the worker
 * source of truth in production (ADR 0002).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { facetsForToken, type TokenFacet } from '@net-vision/taxonomy';
import type { CatalogSale } from '../market/catalog';
import type { FloorSnapshot, SaleAttribution } from '../market/engine';
import type { ListingRecord, ListingState } from '../market/listing-state';
import { decayIfStale, emptyListingRecord } from '../market/listing-state';
import type { MarketEvent } from './market-event';

export type TokenRow = {
  tokenId: string;
  displayNumber: string;
  exists: boolean;
  name: string | null;
  imageUrl: string | null;
  ownerAddress: string | null;
  metadataJson: string | null;
  metadataVerifiedAt: number | null;
  lastSeenAt: number;
};

export type WorkerCheckpoint = {
  phase: 'bootstrap' | 'hot-refresh' | 'unknown-sweep';
  cursor: number;
  processedTotal: number;
  lastTickAt: number;
  lastError: string | null;
  last429At: number | null;
  workerStartedAt: number | null;
  workerHeartbeatAt: number | null;
  lastSuccessAt: number | null;
};

/** Resumable Plate/NFT metadata bootstrap (separate from listing scan). */
export type MetadataCheckpoint = {
  phase: 'brass-priority' | 'full' | 'done';
  cursor: number;
  processedTotal: number;
  missingTotal: number;
  lastTickAt: number;
  lastError: string | null;
  last429At: number | null;
  lastSuccessAt: number | null;
};

/** Failed metadata fetches awaiting exponential backoff (non-blocking). */
export type MetadataRetryItem = {
  tokenId: string;
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string;
  enqueuedAt: number;
};

export type StreamHealth = 'initializing' | 'connected' | 'degraded' | 'disconnected';

export type MaintenanceState = {
  streamHealth: StreamHealth;
  streamSubscribed: boolean;
  streamConnected: boolean;
  streamLastEventAt: number | null;
  streamEventsTotal: number;
  restLastEventAt: number | null;
  restEventsTotal: number;
  restLastPollAt: number | null;
  lastError: string | null;
  seenEventIds: string[];
  eventTimestamps: number[];
  mode: 'stream+rest' | 'rest';
};

export type IndexSnapshot = {
  version: 1;
  taxonomyVersion: string;
  historyStartedAt: number;
  /** Monotonic dual-write revision — Postgres rejects older payloads. */
  snapshotRevision: number;
  tokens: Record<string, TokenRow>;
  listings: Record<string, ListingRecord>;
  categories: Record<string, string[]>;
  tokenFacets: Record<string, TokenFacet[]>;
  sales: CatalogSale[];
  saleAttributions: SaleAttribution[];
  floorHistory: Record<string, FloorSnapshot[]>;
  worker: WorkerCheckpoint;
  metadataWorker: MetadataCheckpoint;
  metadataRetryQueue: MetadataRetryItem[];
  maintenance: MaintenanceState;
  /** Last hydrate outcome — operator diagnostics only. */
  restoredFrom: 'postgres' | 'json' | 'empty' | null;
};

const DEFAULT_PATH = resolve(process.cwd(), 'data', 'market-index.json');

function dbPath(): string {
  return process.env.INDEX_DB_PATH?.trim() || DEFAULT_PATH;
}

function emptySnapshot(): IndexSnapshot {
  return {
    version: 1,
    taxonomyVersion: '2026-09-05.v1',
    historyStartedAt: Date.now(),
    snapshotRevision: 0,
    tokens: {},
    listings: {},
    categories: {},
    tokenFacets: {},
    sales: [],
    saleAttributions: [],
    floorHistory: {},
    worker: {
      phase: 'bootstrap',
      cursor: 0,
      processedTotal: 0,
      lastTickAt: 0,
      lastError: null,
      last429At: null,
      workerStartedAt: null,
      workerHeartbeatAt: null,
      lastSuccessAt: null,
    },
    metadataWorker: {
      phase: 'brass-priority',
      cursor: 0,
      processedTotal: 0,
      missingTotal: 0,
      lastTickAt: 0,
      lastError: null,
      last429At: null,
      lastSuccessAt: null,
    },
    metadataRetryQueue: [],
    maintenance: {
      streamHealth: 'disconnected',
      streamSubscribed: false,
      streamConnected: false,
      streamLastEventAt: null,
      streamEventsTotal: 0,
      restLastEventAt: null,
      restEventsTotal: 0,
      restLastPollAt: null,
      lastError: null,
      seenEventIds: [],
      eventTimestamps: [],
      mode: 'rest',
    },
    restoredFrom: null,
  };
}

function coerceSnapshot(parsed: IndexSnapshot): IndexSnapshot {
  const base = emptySnapshot();
  const worker = { ...base.worker, ...(parsed.worker ?? {}) };
  const metadataWorker = { ...base.metadataWorker, ...(parsed.metadataWorker ?? {}) };
  return {
    ...base,
    ...parsed,
    historyStartedAt: parsed.historyStartedAt || base.historyStartedAt,
    snapshotRevision: parsed.snapshotRevision ?? 0,
    tokenFacets: parsed.tokenFacets ?? {},
    sales: parsed.sales ?? [],
    saleAttributions: parsed.saleAttributions ?? [],
    floorHistory: parsed.floorHistory ?? {},
    tokens: Object.fromEntries(
      Object.entries(parsed.tokens ?? {}).map(([id, row]) => [
        id,
        {
          ...row,
          ownerAddress: row.ownerAddress ?? null,
          metadataJson: row.metadataJson ?? null,
          metadataVerifiedAt: row.metadataVerifiedAt ?? null,
        },
      ]),
    ),
    listings: parsed.listings ?? {},
    categories: parsed.categories ?? {},
    worker,
    metadataWorker,
    metadataRetryQueue: Array.isArray(parsed.metadataRetryQueue)
      ? parsed.metadataRetryQueue
      : [],
    maintenance: {
      ...base.maintenance,
      ...(parsed.maintenance ?? {}),
      seenEventIds: Array.isArray(parsed.maintenance?.seenEventIds)
        ? parsed.maintenance.seenEventIds
        : [],
      eventTimestamps: Array.isArray(parsed.maintenance?.eventTimestamps)
        ? parsed.maintenance.eventTimestamps
        : [],
    },
    restoredFrom: parsed.restoredFrom ?? null,
  };
}

function snapshotHasProgress(snap: IndexSnapshot): boolean {
  return (
    Object.keys(snap.tokens ?? {}).length > 0 ||
    (snap.worker?.processedTotal ?? 0) > 0 ||
    (snap.worker?.cursor ?? 0) > 0 ||
    (snap.metadataWorker?.processedTotal ?? 0) > 0 ||
    (snap.metadataWorker?.cursor ?? 0) > 0 ||
    (snap.metadataRetryQueue?.length ?? 0) > 0
  );
}

let memory: IndexSnapshot | null = null;

export function loadIndex(): IndexSnapshot {
  if (memory) return memory;
  const path = dbPath();
  if (!existsSync(path)) {
    memory = emptySnapshot();
    return memory;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as IndexSnapshot;
    if (parsed?.version !== 1) {
      memory = emptySnapshot();
      return memory;
    }
    memory = coerceSnapshot(parsed);
    return memory;
  } catch {
    memory = emptySnapshot();
    return memory;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Coalesce hot-path Stream writes so 200 events/min do not stampede Postgres. */
export function scheduleSaveIndex(delayMs = 2_000): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveIndex();
  }, delayMs);
  if (typeof saveTimer === 'object' && saveTimer && 'unref' in saveTimer) {
    saveTimer.unref();
  }
}

/**
 * Only the always-on market-worker (or INDEXER_EMBEDDED debug) may persist
 * the index. The web process is a read replica of Postgres.
 */
export function indexWriterEnabled(): boolean {
  if (process.env.MARKET_INDEX_WRITER === 'false') return false;
  if (process.env.MARKET_INDEX_WRITER === 'true') return true;
  if (process.env.INDEXER_EMBEDDED === 'true') return true;
  if (process.env.VITEST) return true;
  return false;
}

export function saveIndex(): void {
  if (!memory) return;
  if (!indexWriterEnabled()) return;
  // Bump revision *before* scheduling the async PG write so a slower
  // older payload cannot overwrite a newer one (WHERE revision < …).
  memory.snapshotRevision = (memory.snapshotRevision ?? 0) + 1;
  const revision = memory.snapshotRevision;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(memory));
  renameSync(tmp, path);
  const snapshot = memory;
  void import('./pg')
    .then(({ scheduleSaveSnapshotToPg }) =>
      scheduleSaveSnapshotToPg(snapshot, { revision }),
    )
    .catch(() => {
      /* pg optional at boot */
    });
}

export type HydrateSource = 'postgres' | 'json' | 'empty';

/**
 * Restore authoritative state before the worker starts.
 * When DATABASE_URL is set and Postgres has progress, Postgres wins
 * even if a local JSON file exists (Railway disks are ephemeral).
 */
export async function hydrateIndexFromPostgres(): Promise<HydrateSource> {
  const local = loadIndex();
  try {
    const { databaseUrl, loadSnapshotFromPg } = await import('./pg');
    if (databaseUrl()) {
      const fromPg = await loadSnapshotFromPg();
      if (fromPg && snapshotHasProgress(fromPg)) {
        memory = coerceSnapshot({ ...fromPg, restoredFrom: 'postgres' });
        saveIndex();
        return 'postgres';
      }
    }
  } catch {
    /* fall through to local */
  }
  if (snapshotHasProgress(local)) {
    local.restoredFrom = 'json';
    memory = local;
    return 'json';
  }
  const empty = loadIndex();
  empty.restoredFrom = 'empty';
  memory = empty;
  return 'empty';
}

/**
 * Read-only refresh for operator health. Loads Postgres into memory without
 * bumping snapshotRevision / dual-writing (web must not fight the worker).
 */
export async function refreshIndexFromPostgres(): Promise<HydrateSource> {
  try {
    const { databaseUrl, loadSnapshotFromPg } = await import('./pg');
    if (databaseUrl()) {
      const fromPg = await loadSnapshotFromPg();
      if (fromPg && snapshotHasProgress(fromPg)) {
        memory = coerceSnapshot({ ...fromPg, restoredFrom: 'postgres' });
        return 'postgres';
      }
    }
  } catch {
    /* keep current memory */
  }
  const local = loadIndex();
  if (snapshotHasProgress(local)) return local.restoredFrom === 'postgres' ? 'postgres' : 'json';
  return 'empty';
}

export function resetIndexForTests(snapshot?: IndexSnapshot): void {
  memory = snapshot ?? emptySnapshot();
}

export function upsertToken(row: TokenRow): void {
  const snap = loadIndex();
  const previous = snap.tokens[row.tokenId];
  snap.tokens[row.tokenId] = {
    ...previous,
    ...row,
    ownerAddress: row.ownerAddress ?? previous?.ownerAddress ?? null,
    metadataJson: row.metadataJson ?? previous?.metadataJson ?? null,
    metadataVerifiedAt: row.metadataVerifiedAt ?? previous?.metadataVerifiedAt ?? null,
  };
}

export function setTokenCategories(tokenId: string, slugs: string[]): void {
  const snap = loadIndex();
  for (const slug of Object.keys(snap.categories)) {
    snap.categories[slug] = (snap.categories[slug] ?? []).filter((id) => id !== tokenId);
  }
  for (const slug of slugs) {
    const members = snap.categories[slug] ?? [];
    if (!members.includes(tokenId)) members.push(tokenId);
    snap.categories[slug] = members;
  }
}

export function listingRecord(tokenId: string, now = Date.now()): ListingRecord {
  const snap = loadIndex();
  const current = snap.listings[tokenId] ?? emptyListingRecord(tokenId);
  const decayed = decayIfStale(current, now);
  if (decayed.state !== current.state) snap.listings[tokenId] = decayed;
  return decayed;
}

export function writeListing(record: ListingRecord): void {
  const snap = loadIndex();
  snap.listings[record.tokenId] = record;
}

export function allListingRecords(): ListingRecord[] {
  const snap = loadIndex();
  return Object.values(snap.listings);
}

export function listingsInState(state: ListingState): ListingRecord[] {
  return allListingRecords().filter((row) => decayIfStale(row).state === state);
}

export function workerCheckpoint(): WorkerCheckpoint {
  return loadIndex().worker;
}

export function writeWorkerCheckpoint(patch: Partial<WorkerCheckpoint>): void {
  const snap = loadIndex();
  snap.worker = { ...snap.worker, ...patch, lastTickAt: Date.now() };
}

export function touchWorkerHeartbeat(now = Date.now()): void {
  const snap = loadIndex();
  snap.worker = {
    ...snap.worker,
    workerHeartbeatAt: now,
    workerStartedAt: snap.worker.workerStartedAt ?? now,
    lastTickAt: now,
  };
}

export function metadataCheckpoint(): MetadataCheckpoint {
  return loadIndex().metadataWorker;
}

export function writeMetadataCheckpoint(patch: Partial<MetadataCheckpoint>): void {
  const snap = loadIndex();
  snap.metadataWorker = { ...snap.metadataWorker, ...patch, lastTickAt: Date.now() };
}

export function metadataRetryQueue(): MetadataRetryItem[] {
  return loadIndex().metadataRetryQueue ?? [];
}

export function enqueueMetadataRetry(
  tokenId: string,
  reason: string,
  backoffMs: number[],
  now = Date.now(),
): MetadataRetryItem {
  const snap = loadIndex();
  const queue = snap.metadataRetryQueue ?? [];
  const existing = queue.find((item) => item.tokenId === tokenId);
  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  const delay =
    backoffMs[Math.min(attemptCount - 1, backoffMs.length - 1)] ??
    backoffMs[backoffMs.length - 1] ??
    60_000;
  const item: MetadataRetryItem = {
    tokenId,
    attemptCount,
    nextAttemptAt: now + delay,
    lastError: reason,
    enqueuedAt: existing?.enqueuedAt ?? now,
  };
  snap.metadataRetryQueue = [...queue.filter((row) => row.tokenId !== tokenId), item];
  return item;
}

export function removeMetadataRetry(tokenId: string): void {
  const snap = loadIndex();
  snap.metadataRetryQueue = (snap.metadataRetryQueue ?? []).filter(
    (item) => item.tokenId !== tokenId,
  );
}

export function dueMetadataRetries(now = Date.now()): MetadataRetryItem[] {
  return (loadIndex().metadataRetryQueue ?? [])
    .filter((item) => item.nextAttemptAt <= now)
    .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
}

export function restoredFrom(): IndexSnapshot['restoredFrom'] {
  return loadIndex().restoredFrom;
}

/** Brass gate: tokens 1..expected with metadataVerifiedAt set. */
export function countVerifiedMetadataInRange(fromId: number, toId: number): number {
  const tokens = loadIndex().tokens;
  let count = 0;
  for (let n = fromId; n <= toId; n += 1) {
    const row = tokens[String(n)];
    if (row?.metadataVerifiedAt) count += 1;
  }
  return count;
}

export function countExistingTokens(): number {
  return Object.values(loadIndex().tokens).filter((row) => row.exists).length;
}

export function countMissingTokens(): number {
  return Object.values(loadIndex().tokens).filter((row) => row.exists === false).length;
}

export function persistMetadataMissing(tokenId: string, reason: string): void {
  upsertToken({
    tokenId,
    displayNumber: tokenId,
    exists: false,
    name: null,
    imageUrl: null,
    ownerAddress: null,
    metadataJson: JSON.stringify({ missing: true, reason }),
    metadataVerifiedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}

export function snapshotRevision(): number {
  return loadIndex().snapshotRevision ?? 0;
}

export function taxonomyMemberships(slug: string): string[] {
  return loadIndex().categories[slug] ?? [];
}

export function setTokenFacets(tokenId: string, facets: TokenFacet[]): void {
  const snap = loadIndex();
  snap.tokenFacets[tokenId] = facets;
  setTokenCategories(tokenId, [...new Set(facets.map((facet) => facet.slug))]);
}

export function tokenFacets(tokenId: string): TokenFacet[] {
  return loadIndex().tokenFacets[tokenId] ?? [];
}

export function persistNftMetadata(
  tokenId: string,
  nft: {
    name?: string | null;
    imageUrl?: string | null;
    ownerAddress?: string | null;
    traits?: Array<{ trait_type?: string; value?: string | number }>;
  },
): TokenFacet[] {
  upsertToken({
    tokenId,
    displayNumber: tokenId,
    exists: true, // metadata fetch proves the NFT exists
    name: nft.name ?? null,
    imageUrl: nft.imageUrl ?? null,
    ownerAddress: nft.ownerAddress ?? null,
    metadataJson: JSON.stringify({ traits: nft.traits ?? [], name: nft.name ?? null }),
    metadataVerifiedAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  const facets = facetsForToken(tokenId, { traits: nft.traits, name: nft.name });
  setTokenFacets(tokenId, facets);
  return facets;
}

export function historyStartedAt(): number {
  return loadIndex().historyStartedAt;
}

const MAX_SALES = 2000;
const MAX_FLOOR_POINTS = 400;

export function ingestSales(sales: CatalogSale[], attributions: SaleAttribution[]): void {
  const snap = loadIndex();
  const existing = new Set(
    snap.sales.map((row) => `${row.orderHash ?? ''}:${row.tokenId}:${row.occurredAt}:${row.price}`),
  );
  for (const sale of sales) {
    const key = `${sale.orderHash ?? ''}:${sale.tokenId}:${sale.occurredAt}:${sale.price}`;
    if (existing.has(key)) continue;
    existing.add(key);
    snap.sales.push(sale);
  }
  const attrKeys = new Set(
    snap.saleAttributions.map((row) => `${row.saleEventId}:${row.categorySlug}`),
  );
  for (const row of attributions) {
    const key = `${row.saleEventId}:${row.categorySlug}`;
    if (attrKeys.has(key)) continue;
    attrKeys.add(key);
    snap.saleAttributions.push(row);
  }
  snap.sales.sort((a, b) => b.occurredAt - a.occurredAt);
  if (snap.sales.length > MAX_SALES) snap.sales.length = MAX_SALES;
}

export function allSales(): CatalogSale[] {
  return loadIndex().sales;
}

export function allAttributions(): SaleAttribution[] {
  return loadIndex().saleAttributions;
}

export function appendFloorSnapshot(slug: string, snapshot: FloorSnapshot): void {
  const snap = loadIndex();
  const series = snap.floorHistory[slug] ?? [];
  const last = series[series.length - 1];
  if (last && snapshot.at - last.at < 60 * 60 * 1000 && last.floor === snapshot.floor) {
    return;
  }
  series.push(snapshot);
  if (series.length > MAX_FLOOR_POINTS) series.splice(0, series.length - MAX_FLOOR_POINTS);
  snap.floorHistory[slug] = series;
}

export function floorHistory(slug: string): FloorSnapshot[] {
  return loadIndex().floorHistory[slug] ?? [];
}

const MAX_SEEN_EVENTS = 4000;
const MAX_EVENT_TIMESTAMPS = 2000;

export function maintenanceState(): MaintenanceState {
  return loadIndex().maintenance;
}

export function patchMaintenance(patch: Partial<MaintenanceState>): void {
  const snap = loadIndex();
  snap.maintenance = { ...snap.maintenance, ...patch };
}

export function wasMarketEventSeen(id: string): boolean {
  return loadIndex().maintenance.seenEventIds.includes(id);
}

export function rememberMarketEvent(event: Pick<MarketEvent, 'id' | 'source' | 'occurredAt'>, now = Date.now()): void {
  const snap = loadIndex();
  const m = snap.maintenance;
  if (!m.seenEventIds.includes(event.id)) {
    m.seenEventIds.push(event.id);
    if (m.seenEventIds.length > MAX_SEEN_EVENTS) {
      m.seenEventIds.splice(0, m.seenEventIds.length - MAX_SEEN_EVENTS);
    }
  }
  m.eventTimestamps.push(now);
  if (m.eventTimestamps.length > MAX_EVENT_TIMESTAMPS) {
    m.eventTimestamps.splice(0, m.eventTimestamps.length - MAX_EVENT_TIMESTAMPS);
  }
  if (event.source === 'stream') {
    m.streamEventsTotal += 1;
    m.streamLastEventAt = now;
  } else {
    m.restEventsTotal += 1;
    m.restLastEventAt = now;
  }
}
