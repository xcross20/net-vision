#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * Records two consecutive OpenSea collection-listings pages to diagnose
 * whether the `next` cursor advances or loops.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { createOpenSeaClient } from '@net-vision/opensea-client';

function summarize(page: { listings: Array<{ order_hash?: string; protocol_data?: { parameters?: { offer?: Array<{ identifierOrCriteria?: string }> } } }>; next?: string | null }) {
  const hashes = page.listings.map((row) => row.order_hash ?? '');
  const tokenIds = page.listings.map((row) => {
    const offer = row.protocol_data?.parameters?.offer?.[0];
    return String(offer?.identifierOrCriteria ?? '');
  });
  return {
    count: page.listings.length,
    next: page.next ?? null,
    firstHash: hashes[0] ?? null,
    lastHash: hashes[hashes.length - 1] ?? null,
    firstToken: tokenIds[0] ?? null,
    lastToken: tokenIds[tokenIds.length - 1] ?? null,
    uniqueHashes: new Set(hashes.filter(Boolean)).size,
    uniqueTokens: new Set(tokenIds.filter(Boolean)).size,
  };
}

async function main() {
  const client = createOpenSeaClient({
    OPENSEA_API_KEY: process.env.OPENSEA_API_KEY,
    OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
  });
  const page1 = await client.getCollectionListings({
    slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
    limit: 200,
  });
  const summary1 = summarize(page1);
  const page2 = await client.getCollectionListings({
    slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
    cursor: page1.next ?? undefined,
    limit: 200,
  });
  const summary2 = summarize(page2);
  const hashes1 = new Set(page1.listings.map((row) => row.order_hash ?? ''));
  const overlap = page2.listings.filter((row) => hashes1.has(row.order_hash ?? '')).length;
  const report = {
    sampledAt: new Date().toISOString(),
    page1: summary1,
    page2: summary2,
    overlapCount: overlap,
    cursorRepeated: summary1.next === summary2.next,
    pagesIdentical: overlap === page1.listings.length && overlap === page2.listings.length,
  };
  const out = resolve(
    process.cwd().endsWith('apps/web') ? process.cwd() : resolve(process.cwd(), 'apps/web'),
    '../../docs/data/OPENSEA_CURSOR_DIAGNOSIS.json',
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
