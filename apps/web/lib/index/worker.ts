/**
 * Background listing reconciliation worker.
 *
 * Never invoked from a request handler. Request paths may *start* the
 * worker (fire-and-forget) but they never await a token scan. Progress
 * is persisted so a process restart resumes the queue.
 *
 * Priority:
 *   1. Known OpenSea examples (966, 628, 870, 507, 756, 635)
 *   2. digits-3 (100..999) — the P0 acceptance category
 *   3. remaining classified members
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { facetsForToken } from '@net-vision/taxonomy';
import { isOpenSeaRateLimited } from '../market/opensea-errors';
import {
  applyObservation,
  type ListingObservation,
  type ListingRecord,
} from '../market/listing-state';
import {
  listingRecord,
  loadIndex,
  saveIndex,
  setTokenFacets,
  upsertToken,
  workerCheckpoint,
  writeListing,
  writeWorkerCheckpoint,
} from './store';

export const PRIORITY_TOKEN_IDS = ['966', '628', '870', '507', '756', '635'] as const;
const DIGITS_3_MIN = 100;
const DIGITS_3_MAX = 999;
const PACE_MS = 500;
const SAVE_EVERY = 10;

export type BestListingLookup = (tokenId: string) => Promise<ListingObservation>;
export type ListingSink = (record: ListingRecord) => void;

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build'
  );
}

function buildQueue(): string[] {
  const seen = new Set<string>();
  const queue: string[] = [];
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    queue.push(id);
  };
  for (const id of PRIORITY_TOKEN_IDS) push(id);
  for (let n = DIGITS_3_MIN; n <= DIGITS_3_MAX; n += 1) push(String(n));
  const max = BUTTON_PRESSER_COLLECTION.maxTokenId;
  for (let n = 1; n <= max; n += 1) push(String(n));
  return queue;
}

function classifyIntoIndex(tokenId: string): void {
  const previous = loadIndex().tokens[tokenId];
  upsertToken({
    tokenId,
    displayNumber: tokenId,
    exists: previous?.exists ?? true,
    name: previous?.name ?? null,
    imageUrl: previous?.imageUrl ?? null,
    ownerAddress: previous?.ownerAddress ?? null,
    metadataJson: previous?.metadataJson ?? null,
    metadataVerifiedAt: previous?.metadataVerifiedAt ?? null,
    lastSeenAt: Date.now(),
  });
  let metadata: { traits?: Array<{ trait_type?: string; value?: string | number }>; name?: string | null } | null =
    null;
  if (previous?.metadataJson) {
    try {
      metadata = JSON.parse(previous.metadataJson) as {
        traits?: Array<{ trait_type?: string; value?: string | number }>;
        name?: string | null;
      };
    } catch {
      metadata = null;
    }
  }
  setTokenFacets(tokenId, facetsForToken(tokenId, metadata));
}

let running = false;
let started = false;

export function isIndexerRunning(): boolean {
  return running;
}

export async function reconcileOne(
  tokenId: string,
  lookup: BestListingLookup,
  sink?: ListingSink,
): Promise<ListingRecord> {
  classifyIntoIndex(tokenId);
  const current = listingRecord(tokenId);
  let observation: ListingObservation;
  try {
    observation = await lookup(tokenId);
  } catch (err) {
    if (isOpenSeaRateLimited(err)) {
      writeWorkerCheckpoint({ last429At: Date.now(), lastError: '429' });
      saveIndex();
      throw err;
    }
    observation = { kind: 'error' };
    writeWorkerCheckpoint({ lastError: err instanceof Error ? err.message : String(err) });
  }
  const next = applyObservation(current, observation);
  writeListing(next);
  sink?.(next);
  return next;
}

export async function runIndexerPass(
  lookup: BestListingLookup,
  options: { maxTokens?: number; sink?: ListingSink; sleepMs?: number } = {},
): Promise<{ processed: number; cursor: number; queueLength: number }> {
  const queue = buildQueue();
  const checkpoint = workerCheckpoint();
  let cursor = Math.min(Math.max(checkpoint.cursor, 0), queue.length);
  const limit = options.maxTokens ?? queue.length - cursor;
  let processed = 0;
  for (let i = 0; i < limit && cursor < queue.length; i += 1) {
    const tokenId = queue[cursor];
    await reconcileOne(tokenId, lookup, options.sink);
    cursor += 1;
    processed += 1;
    writeWorkerCheckpoint({
      cursor,
      processedTotal: checkpoint.processedTotal + processed,
      phase: cursor >= queue.length ? 'hot-refresh' : 'bootstrap',
      lastError: null,
    });
    if (processed % SAVE_EVERY === 0) saveIndex();
    if (options.sleepMs && options.sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.sleepMs));
    }
  }
  saveIndex();
  loadIndex();
  return { processed, cursor, queueLength: queue.length };
}

export function startBackgroundIndexer(lookup: BestListingLookup, sink?: ListingSink): void {
  if (started || isBuildPhase()) return;
  if (process.env.INDEXER_V2_ENABLED === 'false') return;
  if (process.env.VITEST) return;
  started = true;
  running = true;
  const loop = async () => {
    try {
      await runIndexerPass(lookup, { maxTokens: 1, sink, sleepMs: 0 });
      const checkpoint = workerCheckpoint();
      const queue = buildQueue();
      if (checkpoint.cursor >= queue.length) {
        writeWorkerCheckpoint({ phase: 'hot-refresh', cursor: 0 });
        saveIndex();
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
      } else {
        await new Promise((resolve) => setTimeout(resolve, PACE_MS));
      }
    } catch (err) {
      if (isOpenSeaRateLimited(err)) {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      } else {
        await new Promise((resolve) => setTimeout(resolve, PACE_MS * 4));
      }
    }
    if (running) void loop();
  };
  void loop();
}

export function stopBackgroundIndexer(): void {
  running = false;
  started = false;
}
