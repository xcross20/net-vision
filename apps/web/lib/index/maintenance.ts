/**
 * Slice 4 maintenance: Stream (if available) + bounded REST event poll.
 * Listing/metadata loops remain the slow drift / bootstrap path.
 */
import type { OpenSeaClient } from '@net-vision/opensea-client';
import { startCollectionEventPoll } from './event-poll';
import { startHotListingVerify } from './hot-verify';
import { startOpenSeaStreamIngest } from './stream-ingest';
import type { BestListingLookup } from './worker';
import { patchMaintenance, saveIndex } from './store';

let started = false;

export function startMarketMaintenance(
  client: OpenSeaClient,
  lookup: BestListingLookup,
): void {
  if (started || process.env.VITEST) return;
  started = true;
  patchMaintenance({ mode: 'rest', streamHealth: 'disconnected' });
  saveIndex();
  startCollectionEventPoll(client);
  startHotListingVerify(lookup);
  void startOpenSeaStreamIngest().then((ok) => {
    console.log('[maintenance] stream', ok ? 'subscribed (awaiting first event)' : 'rest-only fallback');
  });
}
