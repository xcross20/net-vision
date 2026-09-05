/**
 * Import a market-index.json snapshot into Postgres.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx apps/web/scripts/import-market-index.ts [path]
 *
 * Default path: backups/market-index-latest.json (repo root) or
 * INDEX_DB_PATH / apps/web/data/market-index.json
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importSnapshot, ensureSchema, databaseUrl, saveSnapshotToPg } from '../lib/index/pg.ts';
import type { IndexSnapshot } from '../lib/index/store.ts';

function resolveInputPath(): string {
  const arg = process.argv[2];
  if (arg) return resolve(arg);
  const candidates = [
    resolve(process.cwd(), 'backups/market-index-latest.json'),
    resolve(process.cwd(), '../backups/market-index-latest.json'),
    resolve(process.cwd(), '../../backups/market-index-latest.json'),
    process.env.INDEX_DB_PATH?.trim() || '',
    resolve(process.cwd(), 'data/market-index.json'),
    resolve(process.cwd(), 'apps/web/data/market-index.json'),
  ].filter(Boolean);
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(`No snapshot found. Tried:\n${candidates.join('\n')}`);
}

async function main(): Promise<void> {
  if (!databaseUrl()) {
    throw new Error('DATABASE_URL is required');
  }
  const path = resolveInputPath();
  const raw = JSON.parse(readFileSync(path, 'utf8')) as IndexSnapshot;
  if (raw?.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${String(raw?.version)}`);
  }
  console.log(`Importing ${path}`);
  console.log(`  tokens=${Object.keys(raw.tokens ?? {}).length}`);
  console.log(`  listings=${Object.keys(raw.listings ?? {}).length}`);
  console.log(`  cursor=${raw.worker?.cursor ?? 0}`);
  await ensureSchema();
  // Blob-only first so recovery works even if normalized tables are slow.
  await saveSnapshotToPg(raw, { normalized: false });
  console.log('Blob written. Importing normalized tables…');
  const stats = await importSnapshot(raw);
  console.log('Import complete:', stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
