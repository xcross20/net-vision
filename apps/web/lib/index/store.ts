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
import type { ListingRecord, ListingState } from '../market/listing-state';
import { decayIfStale, emptyListingRecord } from '../market/listing-state';

export type TokenRow = {
  tokenId: string;
  displayNumber: string;
  exists: boolean;
  name: string | null;
  imageUrl: string | null;
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

export type IndexSnapshot = {
  version: 1;
  taxonomyVersion: string;
  tokens: Record<string, TokenRow>;
  listings: Record<string, ListingRecord>;
  categories: Record<string, string[]>;
  worker: WorkerCheckpoint;
};

const DEFAULT_PATH = resolve(process.cwd(), 'data', 'market-index.json');

function dbPath(): string {
  return process.env.INDEX_DB_PATH?.trim() || DEFAULT_PATH;
}

function emptySnapshot(): IndexSnapshot {
  return {
    version: 1,
    taxonomyVersion: '2026-09-05.v1',
    tokens: {},
    listings: {},
    categories: {},
    worker: {
      phase: 'bootstrap',
      cursor: 0,
      processedTotal: 0,
      lastTickAt: 0,
      lastError: null,
      last429At: null,
    },
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
    memory = parsed;
    return memory;
  } catch {
    memory = emptySnapshot();
    return memory;
  }
}

export function saveIndex(): void {
  if (!memory) return;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(memory));
  renameSync(tmp, path);
}

export function resetIndexForTests(snapshot?: IndexSnapshot): void {
  memory = snapshot ?? emptySnapshot();
}

export function upsertToken(row: TokenRow): void {
  const snap = loadIndex();
  snap.tokens[row.tokenId] = row;
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

export function taxonomyMemberships(slug: string): string[] {
  return loadIndex().categories[slug] ?? [];
}
