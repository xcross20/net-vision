/**
 * Background listing reconciliation + Plate metadata bootstrap.
 *
 * Production: started by the standalone market-worker process on boot
 * (ADR 0002). Embedded start inside the Next.js process is opt-in via
 * INDEXER_EMBEDDED=true for local single-process debug only.
 *
 * Listing priority:
 *   1. Known OpenSea examples (966, 628, 870, 507, 756, 635)
 *   2. digits-3 (100..999)
 *   3. remaining supply
 *
 * Metadata bootstrap (separate cursor):
 *   1. 1..999 (Brass acceptance — official Plate supply)
 *   2. 1000..4999, 5000..19999, 20000..max
 * RETRY enqueues with backoff and advances the cursor (no head-of-line block).
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
  countVerifiedMetadataInRange,
  dueMetadataRetries,
  enqueueMetadataRetry,
  listingRecord,
  loadIndex,
  metadataCheckpoint,
  metadataRetryQueue,
  persistMetadataMissing,
  removeMetadataRetry,
  saveIndex,
  setTokenFacets,
  touchWorkerHeartbeat,
  upsertToken,
  workerCheckpoint,
  writeListing,
  writeMetadataCheckpoint,
  writeWorkerCheckpoint,
} from './store';

export const PRIORITY_TOKEN_IDS = ['966', '628', '870', '507', '756', '635'] as const;
const DIGITS_3_MIN = 100;
const DIGITS_3_MAX = 999;
export const BRASS_EXPECTED = 999;
const BRASS_MAX = 999;
const STEEL_MAX = 4999;
const ANODISED_MAX = 19999;
/** Slow enough to leave headroom for page-path OpenSea calls. */
const PACE_MS = 2_500;
const METADATA_PACE_MS = 3_000;
const RATE_LIMIT_SLEEP_MS = 5 * 60_000;
const SAVE_EVERY = 10;
const HEARTBEAT_MS = 15_000;
export const METADATA_RETRY_BACKOFF_MS = [10_000, 30_000, 120_000, 600_000, 1_800_000] as const;
const MAX_METADATA_RETRY_ATTEMPTS = METADATA_RETRY_BACKOFF_MS.length;

export type BestListingLookup = (tokenId: string) => Promise<ListingObservation>;
export type ListingSink = (record: ListingRecord) => void;

/**
 * Tri-state metadata observation. Transport failures are `retry` —
 * enqueued with backoff; the bootstrap cursor still advances.
 */
export type MetadataObservation =
  | { kind: 'found' }
  | { kind: 'missing' }
  | { kind: 'retry'; reason: string };

export type MetadataFetch = (tokenId: string) => Promise<MetadataObservation>;

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

/**
 * Plate metadata bootstrap order: Brass range first (acceptance), then
 * the remaining official Plate splits, then any remainder of supply.
 */
export function buildMetadataQueue(): string[] {
  const max = BUTTON_PRESSER_COLLECTION.maxTokenId;
  const queue: string[] = [];
  const pushRange = (from: number, to: number) => {
    for (let n = from; n <= to && n <= max; n += 1) queue.push(String(n));
  };
  pushRange(1, BRASS_MAX);
  pushRange(BRASS_MAX + 1, STEEL_MAX);
  pushRange(STEEL_MAX + 1, ANODISED_MAX);
  pushRange(ANODISED_MAX + 1, max);
  return queue;
}

function classifyIntoIndex(tokenId: string): void {
  const previous = loadIndex().tokens[tokenId];
  upsertToken({
    tokenId,
    displayNumber: tokenId,
    exists: previous?.exists ?? Boolean(previous?.metadataVerifiedAt),
    name: previous?.name ?? null,
    imageUrl: previous?.imageUrl ?? null,
    ownerAddress: previous?.ownerAddress ?? null,
    metadataJson: previous?.metadataJson ?? null,
    metadataVerifiedAt: previous?.metadataVerifiedAt ?? null,
    lastSeenAt: Date.now(),
  });
  let metadata: {
    traits?: Array<{ trait_type?: string; value?: string | number }>;
    name?: string | null;
  } | null = null;
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

function hasVerifiedMetadata(tokenId: string): boolean {
  const row = loadIndex().tokens[tokenId];
  return Boolean(row?.metadataVerifiedAt && row?.metadataJson);
}

function brassPendingRetryCount(): number {
  return metadataRetryQueue().filter((item) => {
    const n = Number(item.tokenId);
    return Number.isFinite(n) && n >= 1 && n <= BRASS_MAX;
  }).length;
}

export function resolveMetadataPhase(
  cursor: number,
  queueLength: number,
): MetadataCheckpointPhase {
  const brassVerified = countVerifiedMetadataInRange(1, BRASS_MAX);
  const brassPending = brassPendingRetryCount();
  if (brassVerified < BRASS_EXPECTED || brassPending > 0) return 'brass-priority';
  if (cursor >= queueLength && brassPending === 0) return 'done';
  return 'full';
}

type MetadataCheckpointPhase = 'brass-priority' | 'full' | 'done';

let running = false;
let started = false;
let metadataRunning = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function isIndexerRunning(): boolean {
  return running;
}

export function isMetadataBootstrapRunning(): boolean {
  return metadataRunning;
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
  writeWorkerCheckpoint({ lastSuccessAt: Date.now(), lastError: null });
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

async function observeMetadata(
  tokenId: string,
  fetchMetadata: MetadataFetch,
): Promise<MetadataObservation> {
  try {
    return await fetchMetadata(tokenId);
  } catch (err) {
    if (isOpenSeaRateLimited(err)) {
      writeMetadataCheckpoint({ last429At: Date.now(), lastError: '429' });
      saveIndex();
      throw err;
    }
    return {
      kind: 'retry',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function applyMetadataObservation(
  tokenId: string,
  observation: MetadataObservation,
): 'settled' | 'retried' | 'exhausted' {
  if (observation.kind === 'found') {
    removeMetadataRetry(tokenId);
    return 'settled';
  }
  if (observation.kind === 'missing') {
    persistMetadataMissing(tokenId, 'not-found');
    removeMetadataRetry(tokenId);
    return 'settled';
  }
  const existing = metadataRetryQueue().find((item) => item.tokenId === tokenId);
  const nextAttempt = (existing?.attemptCount ?? 0) + 1;
  if (nextAttempt > MAX_METADATA_RETRY_ATTEMPTS) {
    persistMetadataMissing(tokenId, `retry-exhausted:${observation.reason}`);
    removeMetadataRetry(tokenId);
    return 'exhausted';
  }
  enqueueMetadataRetry(tokenId, observation.reason, [...METADATA_RETRY_BACKOFF_MS]);
  return 'retried';
}

/**
 * One metadata bootstrap unit of work: drain one due retry if any,
 * otherwise advance the forward cursor by one token.
 * RETRY never blocks later token IDs.
 */
export async function runMetadataBootstrapPass(
  fetchMetadata: MetadataFetch,
  options: { maxTokens?: number; sleepMs?: number } = {},
): Promise<{
  processed: number;
  cursor: number;
  queueLength: number;
  missing: number;
  retriesQueued: number;
}> {
  const queue = buildMetadataQueue();
  const checkpoint = metadataCheckpoint();
  if (checkpoint.phase === 'done' && metadataRetryQueue().length === 0) {
    return {
      processed: 0,
      cursor: checkpoint.cursor,
      queueLength: queue.length,
      missing: checkpoint.missingTotal,
      retriesQueued: 0,
    };
  }

  let cursor = Math.min(Math.max(checkpoint.cursor, 0), queue.length);
  const limit = options.maxTokens ?? 1;
  let processed = 0;
  let missing = 0;

  for (let i = 0; i < limit; i += 1) {
    const due = dueMetadataRetries();
    if (due.length > 0) {
      const item = due[0];
      if (hasVerifiedMetadata(item.tokenId)) {
        removeMetadataRetry(item.tokenId);
        processed += 1;
      } else {
        const observation = await observeMetadata(item.tokenId, fetchMetadata);
        const result = applyMetadataObservation(item.tokenId, observation);
        if (result === 'settled' && observation.kind === 'missing') missing += 1;
        if (result === 'exhausted') missing += 1;
        if (result === 'settled' || result === 'exhausted') {
          writeMetadataCheckpoint({ lastSuccessAt: Date.now(), lastError: null });
        } else {
          writeMetadataCheckpoint({ lastError: observation.kind === 'retry' ? observation.reason : null });
        }
        processed += 1;
      }
    } else if (cursor < queue.length) {
      const tokenId = queue[cursor];
      if (hasVerifiedMetadata(tokenId)) {
        cursor += 1;
        processed += 1;
      } else {
        const observation = await observeMetadata(tokenId, fetchMetadata);
        const result = applyMetadataObservation(tokenId, observation);
        if (result === 'settled' && observation.kind === 'missing') missing += 1;
        if (result === 'exhausted') missing += 1;
        if (result === 'settled' || result === 'exhausted') {
          writeMetadataCheckpoint({ lastSuccessAt: Date.now(), lastError: null });
        } else {
          writeMetadataCheckpoint({
            lastError: observation.kind === 'retry' ? observation.reason : null,
          });
        }
        cursor += 1;
        processed += 1;
      }
    } else {
      break;
    }

    writeMetadataCheckpoint({
      cursor,
      processedTotal: checkpoint.processedTotal + processed,
      missingTotal: checkpoint.missingTotal + missing,
      phase: resolveMetadataPhase(cursor, queue.length),
    });
    if (processed % SAVE_EVERY === 0) saveIndex();
    if (options.sleepMs && options.sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.sleepMs));
    }
  }

  saveIndex();
  return {
    processed,
    cursor,
    queueLength: queue.length,
    missing: checkpoint.missingTotal + missing,
    retriesQueued: metadataRetryQueue().length,
  };
}

function startHeartbeat(): void {
  const now = Date.now();
  touchWorkerHeartbeat(now);
  writeWorkerCheckpoint({
    workerStartedAt: workerCheckpoint().workerStartedAt ?? now,
    workerHeartbeatAt: now,
  });
  saveIndex();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    touchWorkerHeartbeat();
    saveIndex();
  }, HEARTBEAT_MS);
  if (typeof heartbeatTimer === 'object' && 'unref' in heartbeatTimer) {
    heartbeatTimer.unref();
  }
}

export function startBackgroundIndexer(
  lookup: BestListingLookup,
  sink?: ListingSink,
  fetchMetadata?: MetadataFetch,
): void {
  if (started || isBuildPhase()) return;
  if (process.env.INDEXER_V2_ENABLED === 'false') return;
  if (process.env.VITEST) return;
  started = true;
  running = true;
  startHeartbeat();

  const recentlyRateLimited = () => {
    const listing429 = workerCheckpoint().last429At;
    const meta429 = metadataCheckpoint().last429At;
    const latest = Math.max(listing429 ?? 0, meta429 ?? 0);
    return latest > 0 && Date.now() - latest < RATE_LIMIT_SLEEP_MS;
  };

  const listingLoop = async () => {
    try {
      if (recentlyRateLimited()) {
        await new Promise((resolve) => setTimeout(resolve, 30_000));
      } else {
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
      }
    } catch (err) {
      if (isOpenSeaRateLimited(err)) {
        writeWorkerCheckpoint({ last429At: Date.now(), lastError: '429' });
        saveIndex();
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_SLEEP_MS));
      } else {
        await new Promise((resolve) => setTimeout(resolve, PACE_MS * 4));
      }
    }
    if (running) void listingLoop();
  };
  void listingLoop();

  if (fetchMetadata) {
    metadataRunning = true;
    const metadataLoop = async () => {
      try {
        if (recentlyRateLimited()) {
          await new Promise((resolve) => setTimeout(resolve, 30_000));
        } else {
          const checkpoint = metadataCheckpoint();
          if (checkpoint.phase === 'done' && metadataRetryQueue().length === 0) {
            metadataRunning = false;
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, METADATA_PACE_MS / 2));
          await runMetadataBootstrapPass(fetchMetadata, { maxTokens: 1, sleepMs: 0 });
          await new Promise((resolve) => setTimeout(resolve, METADATA_PACE_MS));
        }
      } catch (err) {
        if (isOpenSeaRateLimited(err)) {
          writeMetadataCheckpoint({ last429At: Date.now(), lastError: '429' });
          saveIndex();
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_SLEEP_MS));
        } else {
          await new Promise((resolve) => setTimeout(resolve, METADATA_PACE_MS * 4));
        }
      }
      if (running && metadataRunning) void metadataLoop();
    };
    void metadataLoop();
  }
}

export function stopBackgroundIndexer(): void {
  running = false;
  started = false;
  metadataRunning = false;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
