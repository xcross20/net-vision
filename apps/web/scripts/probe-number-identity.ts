#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * Probes OpenSea directly (not a Net Vision HTTP route) so identity
 * checks do not depend on a deployed diagnostic endpoint.
 *
 *   railway run -- node --experimental-strip-types apps/web/scripts/probe-number-identity.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { createOpenSeaClient } from '@net-vision/opensea-client';

const outputPath = resolve(
  process.cwd().endsWith('apps/web') ? process.cwd() : resolve(process.cwd(), 'apps/web'),
  'fixtures/number-identity.json',
);

function sampleIds(): string[] {
  const ids = new Set<string>([
    ...Array.from({ length: 20 }, (_, i) => String(i + 1)),
    '9',
    '10',
    '99',
    '100',
    '507',
    '628',
    '635',
    '756',
    '870',
    '966',
    '999',
    '1000',
    '9999',
    '10000',
  ]);
  let seed = 0xc0ffee;
  for (let i = 0; i < 30; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    ids.add(String((seed % 62095) + 1));
  }
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

async function main() {
  const client = createOpenSeaClient({
    OPENSEA_API_KEY: process.env.OPENSEA_API_KEY,
    OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
    OPENSEA_CHAIN: process.env.OPENSEA_CHAIN,
  });
  const chain = process.env.OPENSEA_CHAIN?.trim() || 'robinhood';
  const ids = sampleIds();
  const samples = [];
  for (const tokenId of ids) {
    try {
      const nft = await client.getNFT({
        chain,
        contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
        tokenId,
      });
      const presser = (nft.traits ?? []).find(
        (t) => String(t.trait_type ?? '').toLowerCase() === 'presser',
      );
      samples.push({
        requestedTokenId: tokenId,
        identifier: String(nft.identifier),
        name: nft.name ?? null,
        presserTraitValue: presser?.value != null ? String(presser.value) : null,
      });
      process.stderr.write(`ok ${tokenId} identifier=${nft.identifier} name=${nft.name}\n`);
    } catch (err) {
      process.stderr.write(`fail ${tokenId}: ${err instanceof Error ? err.message : String(err)}\n`);
      samples.push({
        requestedTokenId: tokenId,
        identifier: null,
        name: null,
        presserTraitValue: null,
      });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ sampledAt: new Date().toISOString(), target: 'opensea-direct', samples }, null, 2)}\n`,
  );
  process.stderr.write(`wrote ${samples.length} samples to ${outputPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
