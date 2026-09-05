#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * Number-identity probe.
 *
 * Probes OpenSea for a sample of Button Presser token IDs to verify
 * the invariant:
 *
 *   contract tokenId == OpenSea nft.identifier == Presser trait value
 *
 * Runs against a Net Vision server (local or production) that has the
 * OPENSEA_API_KEY configured. Writes a JSON fixture the unit test
 * (`lib/market/number-identity.test.ts`) reads.
 *
 * Usage:
 *   OPENSEA_TARGET=https://web-production-38d29.up.railway.app \
 *     node --experimental-strip-types apps/web/scripts/probe-number-identity.ts \
 *     --output apps/web/fixtures/number-identity.json
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.env.OPENSEA_TARGET ?? 'http://localhost:3000';
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const eq = arg.indexOf('=');
  if (eq >= 0) {
    args.set(arg.slice(2, eq), arg.slice(eq + 1));
  } else if (i + 1 < process.argv.length) {
    args.set(arg.slice(2), process.argv[i + 1]);
    i++;
  }
}
const outputPath = resolve(
  process.cwd(),
  args.get('output') ?? 'apps/web/fixtures/number-identity.json',
);

function pickSampleIds(): string[] {
  const ids = new Set<string>();
  for (let i = 1; i <= 100; i++) ids.add(String(i));
  for (const id of [9, 10, 99, 100, 999, 1000, 9999, 10000]) ids.add(String(id));
  for (const known of [966, 628, 870, 507, 756, 635, 35153, 35853, 38383, 59695]) ids.add(String(known));
  // Random 1000 across the supply range. Use a deterministic seed so
  // repeat runs produce the same fixture shape.
  let seed = 0xC0FFEE;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };
  for (let i = 0; i < 1000; i++) {
    const n = (rand() % 62095) + 1;
    ids.add(String(n));
  }
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

type Sample = {
  requestedTokenId: string;
  identifier: string | null;
  name: string | null;
  presserTraitValue: string | null;
};

async function probe(tokenId: string): Promise<Sample> {
  const url = `${target.replace(/\/$/, '')}/api/v1/diag/number-identity/${tokenId}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (res.status === 404) {
    return {
      requestedTokenId: tokenId,
      identifier: null,
      name: null,
      presserTraitValue: null,
    };
  }
  if (!res.ok) {
    console.error(`probe ${tokenId} HTTP ${res.status}`);
    return {
      requestedTokenId: tokenId,
      identifier: null,
      name: null,
      presserTraitValue: null,
    };
  }
  const body = (await res.json()) as Record<string, unknown>;
  return {
    requestedTokenId: String(body.requestedTokenId ?? tokenId),
    identifier: body.identifier == null ? null : String(body.identifier),
    name: body.name == null ? null : String(body.name),
    presserTraitValue: body.presserTraitValue == null ? null : String(body.presserTraitValue),
  };
}

async function main() {
  const ids = pickSampleIds();
  console.error(`Probing ${ids.length} ids against ${target}`);
  const samples: Sample[] = [];
  let nextPrint = 100;
  for (let i = 0; i < ids.length; i++) {
    samples.push(await probe(ids[i]));
    if (i + 1 >= nextPrint) {
      console.error(`  ${i + 1}/${ids.length}`);
      nextPrint += 100;
    }
  }

  const fixture = {
    sampledAt: new Date().toISOString(),
    target,
    samples,
  };
  writeFileSync(outputPath, JSON.stringify(fixture, null, 2) + '\n');
  console.error(`Wrote ${samples.length} samples to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

void fileURLToPath;