/**
 * File-backed market index. Schema matches docs/data/MARKET_INDEXER_V2.md
 * so a later Postgres migration is a copy, not a redesign.
 *
 * Storage engine (v1): JSON snapshot on disk. 62k Button Presser rows is
 * a few megabytes. No native addon, so Railway/Nixpacks cannot fail the
 * build on better-sqlite3 compilation. INDEX_DB_PATH overrides the path.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { facetsForToken, type TokenFacet } from '@net-vision/taxonomy';
import type { CatalogSale } from '../market/catalog';
import type { FloorSnapshot, SaleAttribution } from '../market/engine';
import type { ListingRecord, ListingState } from '../market/listing-state';
import { decayIfStale, emptyListingRecord } from '../market/listing-state';

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
    },
    metadataWorker: {
      phase: 'brass-priority',
      cursor: 0,
      processedTotal: 0,
      missingTotal: 0,
      lastTickAt: 0,
      lastError: null,
      last429At: null,
    },
  };
}

function coerceSnapshot(parsed: IndexSnapshot): IndexSnapshot {
  const base = emptySnapshot();
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
    worker: parsed.worker ?? base.worker,
    metadataWorker: parsed.metadataWorker ?? base.metadataWorker,
  };
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

export function saveIndex(): void {
  if (!memory) return;
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

/**
 * If the on-disk snapshot is empty but Postgres has a blob, restore it.
 * Call once at process boot (before the worker starts).
 */
export async function hydrateIndexFromPostgres(): Promise<boolean> {
  const snap = loadIndex();
  if (Object.keys(snap.tokens).length > 0) return false;
  try {
    const { loadSnapshotFromPg } = await import('./pg');
    const fromPg = await loadSnapshotFromPg();
    if (!fromPg || Object.keys(fromPg.tokens ?? {}).length === 0) return false;
    memory = coerceSnapshot(fromPg);
    saveIndex();
    return true;
  } catch {
    return false;
  }
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

export function metadataCheckpoint(): MetadataCheckpoint {
  return loadIndex().metadataWorker;
}

export function writeMetadataCheckpoint(patch: Partial<MetadataCheckpoint>): void {
  const snap = loadIndex();
  snap.metadataWorker = { ...snap.metadataWorker, ...patch, lastTickAt: Date.now() };
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
