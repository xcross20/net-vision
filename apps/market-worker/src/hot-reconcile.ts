/**
 * Hot reconciliation: verify floors / priority tokens without a full supply walk.
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { createOpenSeaClient } from '@net-vision/opensea-client';
import {
  applyObservation,
  emptyListingRecord,
  readListing,
  touchWorkerHeartbeat,
  upsertListing,
} from '@net-vision/market-index';

const PRIORITY = ['966', '628', '870', '507', '756', '635'] as const;
const INTERVAL_MS = Number(process.env.HOT_RECONCILE_MS ?? 30_000);

export function startHotReconcile(options: { workerId: string }): void {
  const key = process.env.OPENSEA_API_KEY?.trim();
  if (!key) return;
  const client = createOpenSeaClient({ OPENSEA_API_KEY: key });

  const tick = async () => {
    for (const tokenId of PRIORITY) {
      try {
        const listing = await client.getBestListing({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          tokenId,
        });
        const current = (await readListing(tokenId)) ?? emptyListingRecord(tokenId);
        if (!listing) {
          const next = applyObservation(current, { kind: 'no-ask' });
          await upsertListing(next);
          continue;
        }
        // Price extraction is best-effort; full order→catalog mapping lives in web today.
        const next = applyObservation(current, {
          kind: 'ask',
          price: Number((listing as { price?: { current?: { value?: string; decimals?: number } } }).price?.current?.value ?? NaN),
          currency: 'USDG',
          orderHash: (listing as { order_hash?: string }).order_hash ?? null,
          seller: null,
          listedAt: Date.now(),
        });
        if (Number.isFinite(next.price)) await upsertListing(next);
      } catch (err) {
        console.error(`[hot-reconcile] ${tokenId}`, err instanceof Error ? err.message : err);
      }
    }
    await touchWorkerHeartbeat(options.workerId, { phase: 'hot-reconcile' });
  };

  void tick();
  setInterval(() => void tick(), INTERVAL_MS).unref();
}
