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

  try {
    const [{ OpenSeaStreamClient }, wsMod] = await Promise.all([
      import('@opensea/sdk/stream'),
      import('ws').catch(() => null),
    ]);
    const transport =
      (globalThis as { WebSocket?: unknown }).WebSocket ??
      (wsMod as { default?: unknown } | null)?.default ??
      (wsMod as { WebSocket?: unknown } | null)?.WebSocket;
    const slug = BUTTON_PRESSER_COLLECTION.openseaSlug;
    const client = new OpenSeaStreamClient({
      apiKey,
      connectOptions: transport ? { transport } : undefined,
      onError: (err: unknown) => {
        console.warn('[stream] transport error', err instanceof Error ? err.message : err);
        patchMaintenance({
          streamConnected: false,
          lastError: err instanceof Error ? err.message : String(err),
        });
      },
    });
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
  } catch (err) {
    console.warn(
      '[stream] unavailable — REST event poll is the maintenance path',
      err instanceof Error ? err.message : err,
    );
    patchMaintenance({
      streamConnected: false,
      mode: 'rest',
      lastError: err instanceof Error ? err.message : String(err),
    });
    saveIndex();
    return false;
  }
}
