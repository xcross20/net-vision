/**
 * Net Vision market-worker (Indexer V3).
 *
 * Single-replica Railway service:
 *   1. Acquire PG advisory lock
 *   2. Ensure schema
 *   3. Connect OpenSea Stream (or fall back to REST events poll)
 *   4. Heartbeat + hot reconcile loop
 *
 * Cold auditor / metadata bootstrap are started after Stream is up.
 * Web must set INDEXER_IN_WEB=false so Next does not double-write.
 */
import http from 'node:http';
import {
  ensureSchema,
  databaseUrl,
  tryAcquireWorkerLock,
  touchWorkerHeartbeat,
  upsertStreamCheckpoint,
} from '@net-vision/market-index';
import { startStreamOrRestPrimary } from './realtime.js';
import { startHotReconcile } from './hot-reconcile.js';

const WORKER_ID = process.env.WORKER_ID?.trim() || 'market-worker';
const PORT = Number(process.env.PORT ?? 8081);

async function main(): Promise<void> {
  if (!databaseUrl()) {
    console.error('[market-worker] DATABASE_URL is required');
    process.exit(1);
  }
  if (!process.env.OPENSEA_API_KEY?.trim()) {
    console.error('[market-worker] OPENSEA_API_KEY is required');
    process.exit(1);
  }

  await ensureSchema();
  const locked = await tryAcquireWorkerLock();
  if (!locked) {
    console.error('[market-worker] could not acquire advisory lock — another replica holds it');
    process.exit(1);
  }
  console.log('[market-worker] advisory lock acquired');

  await touchWorkerHeartbeat(WORKER_ID, { phase: 'starting', processedTotal: 0 });
  await upsertStreamCheckpoint('button-presser', {
    lastConnectedAt: Date.now(),
    lastError: null,
  });

  const mode = await startStreamOrRestPrimary({
    workerId: WORKER_ID,
    collectionSlug: process.env.OPENSEA_COLLECTION_SLUG?.trim() || 'button-presser',
  });
  console.log(`[market-worker] realtime mode=${mode}`);

  startHotReconcile({ workerId: WORKER_ID });

  // Minimal health endpoint for Railway.
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, workerId: WORKER_ID, mode, at: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(PORT, () => {
    console.log(`[market-worker] health on :${PORT}/healthz`);
  });

  const heartbeat = setInterval(() => {
    void touchWorkerHeartbeat(WORKER_ID, { phase: mode, lastError: null });
  }, 15_000);
  heartbeat.unref();
}

main().catch((err) => {
  console.error('[market-worker] fatal', err);
  process.exit(1);
});
