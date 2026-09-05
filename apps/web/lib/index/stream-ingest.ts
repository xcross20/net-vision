/**
 * OpenSea Stream ingest (ADR 0003). Best-effort; missed messages are
 * recovered by the REST event poll + slow listing reconciler.
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { applyMarketEvent } from './apply-event';
import { streamMessageToMarketEvent } from './market-event';
import { patchMaintenance, saveIndex } from './store';

let streamStarted = false;

export async function startOpenSeaStreamIngest(): Promise<boolean> {
  if (streamStarted) return true;
  if (process.env.OPENSEA_STREAM_ENABLED === 'false') return false;
  const apiKey = process.env.OPENSEA_API_KEY?.trim();
  if (!apiKey) return false;

  let OpenSeaStreamClient: new (opts: { apiKey: string }) => {
    onItemListed: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemSold: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemCancelled: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemTransferred: (slug: string, cb: (e: unknown) => void) => () => void;
    onItemMetadataUpdated: (slug: string, cb: (e: unknown) => void) => () => void;
  };
  try {
    ({ OpenSeaStreamClient } = await import('@opensea/sdk/stream'));
  } catch (err) {
    console.warn(
      '[stream] @opensea/sdk/stream unavailable — REST event poll is the maintenance path',
      err instanceof Error ? err.message : err,
    );
    patchMaintenance({ streamConnected: false, mode: 'rest' });
    return false;
  }

  const slug = BUTTON_PRESSER_COLLECTION.openseaSlug;
  const client = new OpenSeaStreamClient({ apiKey });
  const handle = (raw: unknown) => {
    const event = streamMessageToMarketEvent(raw);
    if (!event) return;
    const result = applyMarketEvent(event);
    if (result === 'applied') {
      patchMaintenance({ streamConnected: true, mode: 'stream+rest' });
      saveIndex();
    }
  };

  client.onItemListed(slug, handle);
  client.onItemSold(slug, handle);
  client.onItemCancelled(slug, handle);
  client.onItemTransferred(slug, handle);
  client.onItemMetadataUpdated(slug, handle);
  streamStarted = true;
  patchMaintenance({ streamConnected: true, mode: 'stream+rest' });
  saveIndex();
  console.log('[stream] subscribed to', slug);
  return true;
}
