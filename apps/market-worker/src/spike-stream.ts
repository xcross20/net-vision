/**
 * Day-0 spike: does OpenSea Stream emit events for button-presser (Robinhood)?
 *
 * Usage:
 *   OPENSEA_API_KEY=... npm run spike:stream --workspace=apps/market-worker
 *
 * Listens for 90s and prints any events. Exit 0 even if silent (documents fallback).
 */
import { OpenSeaStreamClient, EventType } from '@opensea/sdk/stream';

const SLUG = process.env.OPENSEA_COLLECTION_SLUG?.trim() || 'button-presser';
const KEY = process.env.OPENSEA_API_KEY?.trim();
const WAIT_MS = Number(process.env.STREAM_SPIKE_MS ?? 90_000);

async function main(): Promise<void> {
  if (!KEY) {
    console.error('OPENSEA_API_KEY is required');
    process.exit(1);
  }

  console.log(JSON.stringify({ spike: 'opensea-stream', slug: SLUG, waitMs: WAIT_MS }, null, 2));

  const client = new OpenSeaStreamClient({ apiKey: KEY });
  let count = 0;
  const seen = new Map<string, number>();

  const onEvent = (event: { event_type?: string; payload?: unknown }) => {
    count += 1;
    const type = event.event_type ?? 'unknown';
    seen.set(type, (seen.get(type) ?? 0) + 1);
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        event_type: type,
        payloadPreview: JSON.stringify(event.payload ?? event).slice(0, 400),
      }),
    );
  };

  client.onEvents(
    SLUG,
    [
      EventType.ITEM_LISTED,
      EventType.ITEM_SOLD,
      EventType.ITEM_CANCELLED,
      EventType.ITEM_TRANSFERRED,
      EventType.ITEM_METADATA_UPDATED,
      EventType.ITEM_RECEIVED_BID,
      EventType.ORDER_INVALIDATE,
      EventType.ORDER_REVALIDATE,
    ],
    onEvent,
  );

  await new Promise((resolve) => setTimeout(resolve, WAIT_MS));

  const summary = {
    slug: SLUG,
    waitedMs: WAIT_MS,
    eventsReceived: count,
    byType: Object.fromEntries(seen),
    recommendation:
      count > 0
        ? 'stream-primary'
        : 'rest-events-primary (Stream silent for this collection/chain during spike window)',
  };
  console.log(JSON.stringify({ summary }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
