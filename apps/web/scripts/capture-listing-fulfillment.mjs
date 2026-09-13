/**
 * Operator script: capture a redacted OpenSea listing + fulfillment payload.
 * Run with staging secrets, never print the API key.
 *
 *   railway run -e staging -s web -- node apps/web/scripts/capture-listing-fulfillment.mjs
 */
import { writeFileSync } from 'node:fs';

const key = process.env.OPENSEA_API_KEY?.trim();
if (!key) {
  console.error('OPENSEA_API_KEY unset');
  process.exit(1);
}

const SLUG = 'button-presser';
const CHAIN = 'robinhood';
const PROTOCOL = '0x0000000000000068F116a894984e2DB1123eB395';
const FULFILLER = process.env.CAPTURE_FULFILLER ?? '0x0000000000000000000000000000000000000abc';

async function os(path, init = {}) {
  const res = await fetch(`https://api.opensea.io${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'x-api-key': key,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

const listings = await os(`/api/v2/listings/collection/${SLUG}/all?limit=5`);
const first = listings.json?.listings?.[0];
if (listings.status !== 200 || !first?.order_hash) {
  console.error('no listing', listings.status);
  process.exit(2);
}

const fulfillment = await os('/api/v2/listings/fulfillment_data', {
  method: 'POST',
  body: JSON.stringify({
    listing: {
      hash: first.order_hash,
      chain: first.chain ?? CHAIN,
      protocol_address: first.protocol_address ?? PROTOCOL,
    },
    fulfiller: { address: FULFILLER },
  }),
});

const redacted = {
  capturedAt: new Date().toISOString(),
  listingStatus: listings.status,
  listing: {
    order_hash: first.order_hash,
    chain: first.chain,
    protocol_address: first.protocol_address,
    asset: first.asset ?? null,
    price: first.price ?? null,
    offerer: first.protocol_data?.parameters?.offerer ?? null,
    consideration: first.protocol_data?.parameters?.consideration ?? null,
    offer: first.protocol_data?.parameters?.offer ?? null,
    conduitKey: first.protocol_data?.parameters?.conduitKey ?? null,
    zone: first.protocol_data?.parameters?.zone ?? null,
  },
  fulfillmentStatus: fulfillment.status,
  fulfillment: fulfillment.json,
};

writeFileSync('/tmp/buy-fulfillment-capture.json', JSON.stringify(redacted, null, 2));
console.log('wrote /tmp/buy-fulfillment-capture.json');
console.log('listing', first.order_hash, 'fulfillment HTTP', fulfillment.status);
