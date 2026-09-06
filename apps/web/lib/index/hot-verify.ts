/**
 * Recovery owner: Stream misses cancel.
 * Detection: this hot queue (LISTED + STALE, cheapest / oldest first).
 * Recovery: best-listing lookup via reconcileOne.
 * SLA: HOT_VERIFY_INTERVAL_MS (90s) per batch of HOT_VERIFY_BATCH.
 *
 * OpenSea REST events do not include cancels, so missed Stream
 * cancellations would stick as LISTED until the slow 62k walk.
 */
import { isOpenSeaRateLimited } from '../market/opensea-errors';
import type { BestListingLookup } from './worker';
import { reconcileOne } from './worker';
import { listingsInState, patchMaintenance, saveIndex } from './store';

export const HOT_VERIFY_INTERVAL_MS = 90_000;
export const HOT_VERIFY_BATCH = 8;

export function pickHotVerifyIds(limit = HOT_VERIFY_BATCH): string[] {
  const listed = [...listingsInState('LISTED'), ...listingsInState('STALE')];
  return [...listed]
    .sort((a, b) => {
      const aStale = a.lastVerifiedAt ?? 0;
      const bStale = b.lastVerifiedAt ?? 0;
      if (aStale !== bStale) return aStale - bStale;
      return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
    })
    .slice(0, limit)
    .map((row) => row.tokenId);
}

export async function runHotVerifyBatch(lookup: BestListingLookup): Promise<number> {
  const ids = pickHotVerifyIds();
  let checked = 0;
  for (const tokenId of ids) {
    await reconcileOne(tokenId, lookup);
    checked += 1;
  }
  if (checked > 0) saveIndex();
  return checked;
}

export function startHotListingVerify(lookup: BestListingLookup): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await runHotVerifyBatch(lookup);
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
    if (!stopped) setTimeout(() => void tick(), HOT_VERIFY_INTERVAL_MS);
  };
  void tick();
  return () => {
    stopped = true;
  };
}
