/**
 * Staff spike (ADR 0003): does OpenSea Stream deliver Button Presser events?
 *
 * Usage:
 *   OPENSEA_API_KEY=... npx tsx --tsconfig tsconfig.json scripts/spike-opensea-stream.ts
 *
 * Runs ~15 minutes (override with SPIKE_MS). Prints per-type counts.
 * Gate for slice 4 realtime ingest — do not mark Stream "done" if counts stay 0
 * while REST collection activity is non-zero.
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';

const DURATION_MS = Number(process.env.SPIKE_MS ?? 15 * 60_000);

async function main(): Promise<void> {
  const apiKey = process.env.OPENSEA_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENSEA_API_KEY required');

  // Dynamic import so the web app does not hard-depend on @opensea/sdk until slice 4.
  let OpenSeaStreamClient: new (opts: { apiKey: string }) => {
    onItemListed: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemSold: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemCancelled: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemTransferred: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemMetadataUpdated: (slug: string, cb: (e: unknown) => void) => () => void;
  };
  try {
    ({ OpenSeaStreamClient } = await import('@opensea/sdk/stream'));
  } catch {
    console.error(
      'Install @opensea/sdk to run this spike: npm install @opensea/sdk -w apps/web',
    );
    process.exit(2);
  }

  const counts: Record<string, number> = {
    listed: 0,
    sold: 0,
    cancelled: 0,
    transferred: 0,
    metadata: 0,
  };
  const slug = BUTTON_PRESSER_COLLECTION.openseaSlug;
  const client = new OpenSeaStreamClient({ apiKey });
  client.onItemListed(slug, () => {
    counts.listed += 1;
  });
  client.onItemSold(slug, () => {
    counts.sold += 1;
  });
  client.onItemCancelled(slug, () => {
    counts.cancelled += 1;
  });
  client.onItemTransferred(slug, () => {
    counts.transferred += 1;
  });
  client.onItemMetadataUpdated(slug, () => {
    counts.metadata += 1;
  });

  console.log(`[spike] listening on ${slug} for ${DURATION_MS}ms`);
  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));
  console.log('[spike] counts', counts);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.warn(
      '[spike] ZERO events — do not ship Stream as primary maintenance without REST fallback',
    );
    process.exit(1);
  }
  console.log('[spike] OK — Stream delivered events for this collection');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
