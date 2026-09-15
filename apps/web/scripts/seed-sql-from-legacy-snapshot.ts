/**
 * Staging-only Schema V2 seed from a legacy IndexSnapshot JSON file.
 *
 *   CONFIRM_SQL_SEED=button-presser \
 *   DATABASE_URL=... \
 *   npx tsx apps/web/scripts/seed-sql-from-legacy-snapshot.ts /path/to/snapshot.json
 *
 * Refuses production. Does not enable SQL reads. Does not DELETE tables.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import type { IndexSnapshot } from '../lib/index/store.ts';
import { ensureSchema, databaseUrl } from '../lib/index/pg.ts';
import { PgMarketRepository } from '../lib/index/market-repository.ts';
import {
  seedSqlFromLegacySnapshot,
  xorTokenIds,
} from '../lib/index/seed-sql-from-legacy-snapshot.ts';
import { BUTTON_PRESSER_COLLECTION_ID } from '../lib/index/schema-v2.ts';

function assertStaging(): void {
  const env = (
    process.env.RAILWAY_ENVIRONMENT_NAME ??
    process.env.RAILWAY_ENVIRONMENT ??
    ''
  ).toLowerCase();
  if (env === 'production') {
    throw new Error('refusing to seed SQL on production');
  }
  if (process.env.CONFIRM_SQL_SEED !== BUTTON_PRESSER_COLLECTION_ID) {
    throw new Error(
      `Set CONFIRM_SQL_SEED=${BUTTON_PRESSER_COLLECTION_ID} to run this staging seed`,
    );
  }
}

async function counts(pool: Pool): Promise<Record<string, number>> {
  const result = await pool.query<{
    events: string;
    tokens: string;
    market: string;
    facets: string;
    sales: string;
  }>(
    `SELECT
       (SELECT count(*) FROM market_events) AS events,
       (SELECT count(*) FROM tokens) AS tokens,
       (SELECT count(*) FROM token_market_state) AS market,
       (SELECT count(*) FROM token_facets) AS facets,
       (SELECT count(*) FROM sales) AS sales`,
  );
  const row = result.rows[0];
  return {
    market_events: Number(row?.events ?? 0),
    tokens: Number(row?.tokens ?? 0),
    token_market_state: Number(row?.market ?? 0),
    token_facets: Number(row?.facets ?? 0),
    sales: Number(row?.sales ?? 0),
  };
}

async function main(): Promise<void> {
  assertStaging();
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is required');
  const path = resolve(process.argv[2] ?? '');
  if (!path) throw new Error('usage: seed-sql-from-legacy-snapshot.ts <snapshot.json>');

  const raw = JSON.parse(readFileSync(path, 'utf8')) as IndexSnapshot;
  if (raw?.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${String(raw?.version)}`);
  }

  await ensureSchema();
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : undefined,
    max: 4,
  });
  try {
    const before = await counts(pool);
    const repo = new PgMarketRepository(pool);
    const report = await seedSqlFromLegacySnapshot({
      repo,
      snapshot: raw,
      collectionId: BUTTON_PRESSER_COLLECTION_ID,
    });
    const after = await counts(pool);
    const states = ['LISTED', 'STALE', 'UNLISTED_VERIFIED'] as const;
    const parity: Record<string, { snapshot: number; sql: number; missingInSql: number; extraInSql: number }> =
      {};
    for (const state of states) {
      const snapIds = Object.values(raw.listings ?? {})
        .filter((row) => row.state === state)
        .map((row) => String(row.tokenId));
      const sql = await pool.query<{ token_id: number }>(
        `SELECT token_id FROM token_market_state
          WHERE collection_id = $1 AND listing_state = $2`,
        [BUTTON_PRESSER_COLLECTION_ID, state],
      );
      const xor = xorTokenIds(
        snapIds,
        sql.rows.map((row) => String(row.token_id)),
      );
      parity[state] = {
        snapshot: snapIds.length,
        sql: sql.rowCount ?? 0,
        missingInSql: xor.missingInActual.length,
        extraInSql: xor.extraInActual.length,
      };
    }
    const categorySlugs = ['material-brass', 'material-steel', 'digits-3', 'palindrome'];
    const categories: Record<string, { snapshot: number; sql: number; missingInSql: number; extraInSql: number }> =
      {};
    for (const slug of categorySlugs) {
      const snapIds = Object.entries(raw.tokenFacets ?? {})
        .filter(([, facets]) => Array.isArray(facets) && facets.some((f) => f.slug === slug))
        .map(([id]) => id);
      const sql = await pool.query<{ token_id: number }>(
        `SELECT token_id FROM token_facets WHERE collection_id = $1 AND slug = $2`,
        [BUTTON_PRESSER_COLLECTION_ID, slug],
      );
      const xor = xorTokenIds(
        snapIds,
        sql.rows.map((row) => String(row.token_id)),
      );
      categories[slug] = {
        snapshot: snapIds.length,
        sql: sql.rowCount ?? 0,
        missingInSql: xor.missingInActual.length,
        extraInSql: xor.extraInActual.length,
      };
    }
    console.log(
      JSON.stringify(
        {
          file: path,
          environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.RAILWAY_ENVIRONMENT,
          before,
          seed: report,
          after,
          parity,
          categories,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
