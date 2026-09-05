/**
 * Operator-facing indexer health projection (SPEC claim 5).
 * Pure reads over persisted worker state — no OpenSea calls.
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { databaseUrl } from './pg';
import {
  countExistingTokens,
  countMissingTokens,
  countVerifiedMetadataInRange,
  maintenanceState,
  metadataCheckpoint,
  metadataRetryQueue,
  restoredFrom,
  workerCheckpoint,
} from './store';
import { eventsInWindow } from './market-event';
import { deriveStreamHealth } from './stream-health';
import type { StreamHealth } from './store';
import { BRASS_EXPECTED, isIndexerRunning, isMetadataBootstrapRunning } from './worker';

export const WORKER_HEARTBEAT_STALE_MS = 60_000;

const STEEL_MAX = 4999;
const ANODISED_MAX = 19999;
const LISTING_QUEUE_LENGTH = BUTTON_PRESSER_COLLECTION.maxTokenId; // approx; priority dupes ignored for %
const METADATA_QUEUE_LENGTH = BUTTON_PRESSER_COLLECTION.maxTokenId;

export type IndexerHealthReport = {
  workerOnline: boolean;
  listingWorker: {
    running: boolean;
    phase: string;
    cursor: number;
    processedTotal: number;
    progressPercent: number;
    lastSuccessAt: number | null;
    lastError: string | null;
    last429At: number | null;
  };
  metadataWorker: {
    running: boolean;
    phase: string;
    cursor: number;
    processedTotal: number;
    progressPercent: number;
    lastSuccessAt: number | null;
    lastError: string | null;
    last429At: number | null;
  };
  listingCursor: number;
  metadataCursor: number;
  listingProgressPercent: number;
  metadataProgressPercent: number;
  brassMetadataVerified: number;
  brassExpected: number;
  brassComplete: boolean;
  steelMetadataVerified: number;
  steelExpected: number;
  anodisedMetadataVerified: number;
  anodisedExpected: number;
  printedMetadataVerified: number;
  printedExpected: number;
  lastSuccessfulListingCheck: number | null;
  lastSuccessfulMetadataCheck: number | null;
  lastError: string | null;
  last429: number | null;
  retriesQueued: number;
  postgresConnected: boolean;
  restoredFrom: 'postgres' | 'json' | 'empty' | null;
  workerStartedAt: number | null;
  workerHeartbeatAt: number | null;
  heartbeatAgeMs: number | null;
  embeddedIndexerAllowed: boolean;
  discoveryMaxTokenId: number;
  officialExistingSupply: number;
  tokensExisting: number;
  tokensMissing: number;
  maintenance: {
    mode: 'stream+rest' | 'rest';
    streamHealth: StreamHealth;
    streamConnected: boolean;
    streamLastEventAt: number | null;
    streamEventsTotal: number;
    restLastEventAt: number | null;
    restEventsTotal: number;
    restLastPollAt: number | null;
    eventsLast15m: number;
    lastError: string | null;
  };
};

function progressPercent(cursor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((cursor / total) * 1000) / 10);
}

export function buildIndexerHealthReport(now = Date.now()): IndexerHealthReport {
  const listing = workerCheckpoint();
  const metadata = metadataCheckpoint();
  const heartbeatAt = listing.workerHeartbeatAt;
  const heartbeatAgeMs = heartbeatAt != null ? now - heartbeatAt : null;
  const workerOnline =
    heartbeatAt != null && heartbeatAgeMs != null && heartbeatAgeMs <= WORKER_HEARTBEAT_STALE_MS;

  const brassMetadataVerified = countVerifiedMetadataInRange(1, BRASS_EXPECTED);
  const steelMetadataVerified = countVerifiedMetadataInRange(BRASS_EXPECTED + 1, STEEL_MAX);
  const anodisedMetadataVerified = countVerifiedMetadataInRange(STEEL_MAX + 1, ANODISED_MAX);
  const printedMetadataVerified = countVerifiedMetadataInRange(
    ANODISED_MAX + 1,
    BUTTON_PRESSER_COLLECTION.maxTokenId,
  );

  const listingProgressPercent = progressPercent(listing.cursor, LISTING_QUEUE_LENGTH);
  const metadataProgressPercent = progressPercent(metadata.cursor, METADATA_QUEUE_LENGTH);

  const last429 = Math.max(listing.last429At ?? 0, metadata.last429At ?? 0) || null;
  const lastError = metadata.lastError ?? listing.lastError;

  // Process-local loop flags are only meaningful when the indexer is
  // embedded in this process. On the web service they are always false
  // after cutover — use heartbeat truth instead.
  const embedded = process.env.INDEXER_EMBEDDED === 'true';
  const listingRunning = embedded ? isIndexerRunning() : workerOnline;
  const metadataRunning = embedded ? isMetadataBootstrapRunning() : workerOnline;
  const maint = maintenanceState();
  const restEventsLast15m = eventsInWindow(maint.eventTimestamps, now);
  const streamHealth = deriveStreamHealth({
    subscribed: maint.streamSubscribed,
    lastEventAt: maint.streamLastEventAt,
    lastError: maint.lastError,
    restEventsLast15m,
    now,
  });

  return {
    workerOnline,
    listingWorker: {
      running: listingRunning,
      phase: listing.phase,
      cursor: listing.cursor,
      processedTotal: listing.processedTotal,
      progressPercent: listingProgressPercent,
      lastSuccessAt: listing.lastSuccessAt,
      lastError: listing.lastError,
      last429At: listing.last429At,
    },
    metadataWorker: {
      running: metadataRunning,
      phase: metadata.phase,
      cursor: metadata.cursor,
      processedTotal: metadata.processedTotal,
      progressPercent: metadataProgressPercent,
      lastSuccessAt: metadata.lastSuccessAt,
      lastError: metadata.lastError,
      last429At: metadata.last429At,
    },
    listingCursor: listing.cursor,
    metadataCursor: metadata.cursor,
    listingProgressPercent,
    metadataProgressPercent,
    brassMetadataVerified,
    brassExpected: BRASS_EXPECTED,
    brassComplete: brassMetadataVerified >= BRASS_EXPECTED,
    steelMetadataVerified,
    steelExpected: STEEL_MAX - BRASS_EXPECTED,
    anodisedMetadataVerified,
    anodisedExpected: ANODISED_MAX - STEEL_MAX,
    printedMetadataVerified,
    printedExpected: BUTTON_PRESSER_COLLECTION.maxTokenId - ANODISED_MAX,
    lastSuccessfulListingCheck: listing.lastSuccessAt,
    lastSuccessfulMetadataCheck: metadata.lastSuccessAt,
    lastError,
    last429,
    retriesQueued: metadataRetryQueue().length,
    postgresConnected: Boolean(databaseUrl()),
    restoredFrom: restoredFrom(),
    workerStartedAt: listing.workerStartedAt,
    workerHeartbeatAt: heartbeatAt,
    heartbeatAgeMs,
    embeddedIndexerAllowed: embedded,
    discoveryMaxTokenId: BUTTON_PRESSER_COLLECTION.maxTokenId,
    officialExistingSupply: BUTTON_PRESSER_COLLECTION.officialExistingSupply,
    tokensExisting: countExistingTokens(),
    tokensMissing: countMissingTokens(),
    maintenance: {
      mode: maint.mode,
      streamHealth,
      streamConnected: streamHealth === 'connected',
      streamLastEventAt: maint.streamLastEventAt,
      streamEventsTotal: maint.streamEventsTotal,
      restLastEventAt: maint.restLastEventAt,
      restEventsTotal: maint.restEventsTotal,
      restLastPollAt: maint.restLastPollAt,
      eventsLast15m: restEventsLast15m,
      lastError: maint.lastError,
    },
  };
}
