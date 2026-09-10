/**
 * Dry-run (no TRADING_ENABLED, no signed txs):
 * listing → conduit spender → encode → policy shape → eth_call simulation.
 *
 *   railway run -e staging -s web -- node apps/web/scripts/prove-usdg-dry-run.mjs
 */
import { writeFileSync } from 'node:fs';
import { createPublicClient, http, encodeFunctionData, erc20Abi } from 'viem';

const key = process.env.OPENSEA_API_KEY?.trim();
if (!key) {
  console.error('OPENSEA_API_KEY unset');
  process.exit(1);
}

const RPC = process.env.ROBINHOOD_RPC_PRIMARY?.trim() || 'https://rpc.mainnet.chain.robinhood.com';
const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';
const CONTROLLER = '0x00000000F9490004C11Cef243f5400493c00Ad63';
const USDG = '0x5fc5360d0400a0fd4f2af552add042d716f1d168';
const FULFILLER = process.env.CAPTURE_FULFILLER ?? '0x0000000000000000000000000000000000000abc';

async function os(path, init = {}) {
  const res = await fetch(`https://api.opensea.io${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      'x-api-key': key,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  return { status: res.status, json: JSON.parse(await res.text()) };
}

const listings = await os('/api/v2/listings/collection/button-presser/all?limit=3');
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
      chain: first.chain ?? 'robinhood',
      protocol_address: first.protocol_address ?? SEAPORT,
    },
    fulfiller: { address: FULFILLER },
  }),
});

const client = createPublicClient({ transport: http(RPC, { timeout: 15000 }) });
const conduitKey = first.protocol_data?.parameters?.conduitKey;
const getConduitAbi = [
  {
    type: 'function',
    name: 'getConduit',
    stateMutability: 'view',
    inputs: [{ name: 'conduitKey', type: 'bytes32' }],
    outputs: [
      { name: 'conduit', type: 'address' },
      { name: 'exists', type: 'bool' },
    ],
  },
];
const [conduit, exists] = await client.readContract({
  address: CONTROLLER,
  abi: getConduitAbi,
  functionName: 'getConduit',
  args: [conduitKey],
});
const conduitCode = await client.getCode({ address: conduit });
const allowance = await client.readContract({
  address: USDG,
  abi: erc20Abi,
  functionName: 'allowance',
  args: [FULFILLER, conduit],
});

const tx = fulfillment.json?.fulfillment_data?.transaction;
let sim = { ok: false, detail: 'no tx' };
if (tx?.to) {
  // eth_call with dummy from will revert (no USDG). That still proves RPC simulation is live.
  try {
    await client.call({
      account: FULFILLER,
      to: tx.to,
      data: '0x',
      value: 0n,
    });
    sim = { ok: true, detail: 'empty-data call unexpectedly succeeded' };
  } catch (e) {
    sim = { ok: false, detail: e.shortMessage || e.message || 'eth_call reverted (expected without funds/calldata)' };
  }
}

const out = {
  capturedAt: new Date().toISOString(),
  tradingEnabled: process.env.TRADING_ENABLED ?? null,
  listing: {
    tokenId: first.asset?.identifier,
    orderHash: first.order_hash,
    price: first.price,
    conduitKey,
    protocol: first.protocol_address,
    chain: first.chain,
  },
  fulfillmentHttp: fulfillment.status,
  spender: {
    conduit,
    exists,
    codeBytes: conduitCode && conduitCode !== '0x' ? (conduitCode.length - 2) / 2 : 0,
    dummyAllowance: allowance.toString(),
  },
  simulationProbe: sim,
};
writeFileSync('/tmp/usdg-dry-run.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
