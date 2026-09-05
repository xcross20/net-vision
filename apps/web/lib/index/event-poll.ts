/**
 * Bounded REST collection-events poll. Maintenance path when Stream is
 * silent, and always-on catch-up for missed Stream messages (ADR 0003).
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import type { OpenSeaClient } from '@net-vision/opensea-client';
import { isOpenSeaRateLimited } from '../market/opensea-errors';
import { applyMarketEvent } from './apply-event';
import { restEventToMarketEvent } from './market-event';
import { maintenanceState, patchMaintenance, saveIndex } from './store';

export const REST_POLL_MS = 45_000;
const OVERLAP_MS = 2 * 60_000;
const PAGE_LIMIT = 50;

export async function pollCollectionEventsOnce(
  client: OpenSeaClient,
  options: { afterMs?: number } = {},
): Promise<{ applied: number; seen: number }> {
  const afterMs = options.afterMs ?? Date.now() - OVERLAP_MS;
  const afterSec = Math.floor(afterMs / 1000);
  const page = await client.getCollectionEvents({
    slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
    limit: PAGE_LIMIT,
    after: afterSec,
  });
  const raw = page.asset_events ?? page.events ?? [];
  let applied = 0;
  for (const row of raw) {
    const event = restEventToMarketEvent(row);
    if (!event) continue;
    const result = applyMarketEvent(event);
    if (result === 'applied') applied += 1;
  }
  patchMaintenance({ restLastPollAt: Date.now() });
  if (applied > 0) saveIndex();
  return { applied, seen: raw.length };
}

export function startCollectionEventPoll(client: OpenSeaClient): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const last = maintenanceState().restLastEventAt ?? maintenanceState().restLastPollAt;
      await pollCollectionEventsOnce(client, {
        afterMs: last ? last - OVERLAP_MS : Date.now() - 10 * 60_000,
      });
    } catch (err) {
      if (isOpenSeaRateLimited(err)) {
        patchMaintenance({ lastError: '429' });
        saveIndex();
        if (!stopped) setTimeout(() => void tick(), 5 * 60_000);
        return;
      }
      patchMaintenance({
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
    if (!stopped) setTimeout(() => void tick(), REST_POLL_MS);
  };
  void tick();
  return () => {
    stopped = true;
  };
}
