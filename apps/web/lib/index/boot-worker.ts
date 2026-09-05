/**
 * Standalone market-worker boot sequence.
 * Starts indexing immediately — no HTTP request, no browser, no laptop.
 */
import { startStandaloneMarketIndexer } from '../market/open-sea-source';
import { hydrateIndexFromPostgres, saveIndex } from './store';
import { ensureSchema, databaseUrl } from './pg';

export async function bootMarketWorker(): Promise<void> {
  console.log('[market-worker] boot starting');

  if (databaseUrl()) {
    const ok = await ensureSchema();
    console.log('[market-worker] postgres schema', ok ? 'ready' : 'unavailable');
  } else {
    console.warn('[market-worker] DATABASE_URL unset — using local JSON only');
  }

  const source = await hydrateIndexFromPostgres();
  console.log('[market-worker] restoredFrom=', source);

  if (!process.env.OPENSEA_API_KEY?.trim()) {
    throw new Error('OPENSEA_API_KEY is required for market-worker');
  }

  startStandaloneMarketIndexer();
  saveIndex();
  console.log('[market-worker] indexer loops started — heartbeat every 15s');
}
