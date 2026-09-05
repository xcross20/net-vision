/**
 * Railway / local entrypoint for the always-on market worker.
 *
 *   npx tsx apps/web/scripts/run-market-worker.ts
 *
 * Requires OPENSEA_API_KEY. DATABASE_URL strongly recommended in production.
 */
import { bootMarketWorker } from '../lib/index/boot-worker';

bootMarketWorker().catch((err) => {
  console.error('[market-worker] fatal', err instanceof Error ? err.message : err);
  process.exit(1);
});
