/**
 * Resolve the ERC-20 approval spender for a Seaport listing.
 *
 * If fulfillerConduitKey is bytes32(0), Seaport transfers directly and
 * the spender is Seaport. Otherwise ConduitController.getConduit(key)
 * must return exists=true and the conduit must have bytecode. Seaport
 * must be an open channel on that conduit.
 */
import { createPublicClient, http, type Hex } from 'viem';
import {
  ALLOWLISTED_PROTOCOLS,
  ROBINHOOD_CHAIN,
  ZERO_CONDUIT_KEY,
} from '@net-vision/chain-config';

export type ResolvedSpender = {
  spender: `0x${string}`;
  source: 'seaport-direct' | 'conduit';
  conduitKey: Hex;
  exists: boolean;
  codeBytes: number;
  seaportChannelOpen: boolean | null;
};

const GET_CONDUIT_ABI = [
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
] as const;

const CHANNEL_ABI = [
  {
    type: 'function',
    name: 'getChannelStatus',
    stateMutability: 'view',
    inputs: [
      { name: 'conduit', type: 'address' },
      { name: 'channel', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

function rpcUrl(): string | null {
  return (
    process.env.ROBINHOOD_RPC_PRIMARY?.trim() ||
    process.env.RPC_URL?.trim() ||
    ROBINHOOD_CHAIN.rpcUrls.default.http[0] ||
    null
  );
}

export function normalizeConduitKey(raw: string | null | undefined): Hex | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(key)) return null;
  return key as Hex;
}

export function isZeroConduitKey(key: Hex): boolean {
  return key.toLowerCase() === ZERO_CONDUIT_KEY.toLowerCase();
}

export async function resolveApprovalSpender(conduitKeyRaw: string | null | undefined): Promise<ResolvedSpender> {
  const key = normalizeConduitKey(conduitKeyRaw);
  if (!key) {
    throw new Error('conduitKey missing or malformed');
  }
  if (isZeroConduitKey(key)) {
    return {
      spender: ALLOWLISTED_PROTOCOLS.seaport16,
      source: 'seaport-direct',
      conduitKey: key,
      exists: true,
      codeBytes: 1,
      seaportChannelOpen: null,
    };
  }
  const url = rpcUrl();
  if (!url) throw new Error('no RPC URL to resolve conduit');
  const client = createPublicClient({
    chain: ROBINHOOD_CHAIN,
    transport: http(url, { timeout: 12_000 }),
  });
  const [conduit, exists] = await client.readContract({
    address: ALLOWLISTED_PROTOCOLS.conduitController,
    abi: GET_CONDUIT_ABI,
    functionName: 'getConduit',
    args: [key],
  });
  if (!exists) {
    throw new Error(`conduitKey is not deployed: ${key}`);
  }
  const code = await client.getCode({ address: conduit });
  const codeBytes = code && code !== '0x' ? (code.length - 2) / 2 : 0;
  if (codeBytes === 0) {
    throw new Error(`conduit ${conduit} has no code`);
  }
  const seaportChannelOpen = await client.readContract({
    address: ALLOWLISTED_PROTOCOLS.conduitController,
    abi: CHANNEL_ABI,
    functionName: 'getChannelStatus',
    args: [conduit, ALLOWLISTED_PROTOCOLS.seaport16],
  });
  if (!seaportChannelOpen) {
    throw new Error(`Seaport is not an open channel on conduit ${conduit}`);
  }
  return {
    spender: conduit,
    source: 'conduit',
    conduitKey: key,
    exists: true,
    codeBytes,
    seaportChannelOpen: true,
  };
}
