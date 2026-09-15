/**
 * A3 Gate 2–3 sample: blob vs SQL on the same Postgres.
 * Does not switch request-path reads. Staging only.
 *
 *   railway run --service web --environment staging -- npx tsx apps/web/scripts/a3-sample-parity.ts
 */
import pg from 'pg';
import { BUTTON_PRESSER_COLLECTION_ID } from '../lib/index/schema-v2.ts';

const SAMPLE_LISTED_HINTS = ['966', '628', '870', '507', '756', '635'];

type Listing = {
  tokenId: string;
  state: string;
  price: number | null;
  orderHash: string | null;
};

function blobListings(payload: { listings?: Record<string, Listing> }): Listing[] {
  return Object.values(payload.listings ?? {});
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const envName = process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.RAILWAY_ENVIRONMENT ?? 'unknown';
  if (envName === 'production') {
    throw new Error('refusing to run A3 parity against production');
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : undefined,
  });
  try {
    const counts = await pool.query<{
      events: string;
      tokens: string;
      market: string;
      facets: string;
    }>(
      `SELECT
         (SELECT count(*) FROM market_events) AS events,
         (SELECT count(*) FROM tokens) AS tokens,
         (SELECT count(*) FROM token_market_state) AS market,
         (SELECT count(*) FROM token_facets) AS facets`,
    );
    const blob = await pool.query<{ payload: { listings?: Record<string, Listing> }; revision: string }>(
      `SELECT payload, revision FROM index_blob WHERE id = 'market-index'`,
    );
    const payload = blob.rows[0]?.payload ?? { listings: {} };
    const listings = blobListings(payload);
    const listed = listings.filter((r) => r.state === 'LISTED');
    const unlisted = listings.filter((r) => r.state === 'UNLISTED_VERIFIED');

    const sqlListed = await pool.query<{ token_id: number; listing_state: string; best_order_hash: string | null; best_price_decimal: string | null }>(
      `SELECT token_id, listing_state, best_order_hash, best_price_decimal
         FROM token_market_state
        WHERE collection_id = $1 AND listing_state = 'LISTED'
        ORDER BY token_id
        LIMIT 20`,
      [BUTTON_PRESSER_COLLECTION_ID],
    );

    const mismatches: string[] = [];
    const sampleIds = [
      ...SAMPLE_LISTED_HINTS,
      ...listed.slice(0, 10).map((r) => r.tokenId),
      ...unlisted.slice(0, 10).map((r) => r.tokenId),
    ];
    const unique = [...new Set(sampleIds)].slice(0, 30);
    for (const id of unique) {
      const blobRow = listings.find((r) => r.tokenId === id);
      const sql = await pool.query(
        `SELECT listing_state, best_order_hash, best_price_decimal
           FROM token_market_state
          WHERE collection_id = $1 AND token_id = $2`,
        [BUTTON_PRESSER_COLLECTION_ID, Number(id)],
      );
      const sqlRow = sql.rows[0] as
        | { listing_state: string; best_order_hash: string | null; best_price_decimal: string | null }
        | undefined;
      if (!blobRow && !sqlRow) continue;
      if (!sqlRow) {
        mismatches.push(`#${id} in blob (${blobRow?.state}) missing from SQL`);
        continue;
      }
      if (!blobRow) {
        mismatches.push(`#${id} in SQL (${sqlRow.listing_state}) missing from blob`);
        continue;
      }
      if (blobRow.state !== sqlRow.listing_state) {
        mismatches.push(`#${id} state blob=${blobRow.state} sql=${sqlRow.listing_state}`);
      }
    }

    const report = {
      environment: envName,
      blobRevision: blob.rows[0]?.revision ?? null,
      sql: {
        market_events: Number(counts.rows[0]?.events ?? 0),
        tokens: Number(counts.rows[0]?.tokens ?? 0),
        token_market_state: Number(counts.rows[0]?.market ?? 0),
        token_facets: Number(counts.rows[0]?.facets ?? 0),
        listedRows: sqlListed.rowCount ?? 0,
      },
      blob: {
        listingRows: listings.length,
        listed: listed.length,
        unlistedVerified: unlisted.length,
      },
      sampleChecked: unique.length,
      mismatches,
      verdict:
        Number(counts.rows[0]?.market ?? 0) > 0 && mismatches.length === 0
          ? 'SAFE TO CONTINUE POPULATION'
          : Number(counts.rows[0]?.market ?? 0) === 0
            ? 'BLOCK: SQL market state still empty'
            : 'BLOCK: sample mismatches',
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.verdict.startsWith('SAFE')) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
