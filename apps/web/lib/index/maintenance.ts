/**
 * Slice 4 maintenance: Stream (if available) + bounded REST event poll.
 * Listing/metadata loops remain the slow drift / bootstrap path.
 */
import type { OpenSeaClient } from '@net-vision/opensea-client';
import { startCollectionEventPoll } from './event-poll';
import { startOpenSeaStreamIngest } from './stream-ingest';
import { patchMaintenance, saveIndex } from './store';

let started = false;

export function startMarketMaintenance(client: OpenSeaClient): void {
  if (started || process.env.VITEST) return;
  started = true;
  patchMaintenance({ mode: 'rest' });
  saveIndex();
  startCollectionEventPoll(client);
  void startOpenSeaStreamIngest().then((ok) => {
    console.log('[maintenance] stream', ok ? 'connected' : 'rest-only fallback');
  });
}
