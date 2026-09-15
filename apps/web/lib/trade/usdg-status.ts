/**
 * USDG balance/allowance knowledge. Unknown must never render as 0.
 * Allowance spender is the resolved Seaport conduit (or Seaport if key is 0).
 */
import { createPublicClient, http, erc20Abi } from 'viem';
import { PAYMENT_TOKENS, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { resolveApprovalSpender } from './resolve-conduit';

export type AmountKnowledge =
  | { state: 'UNKNOWN'; raw: string | null }
  | { state: 'KNOWN_SUFFICIENT'; raw: string }
  | { state: 'KNOWN_INSUFFICIENT'; raw: string };

export function classifyAmount(raw: bigint | null, required: bigint | null): AmountKnowledge {
  if (raw == null) return { state: 'UNKNOWN', raw: null };
  if (required == null) return { state: 'UNKNOWN', raw: raw.toString() };
  if (raw >= required) return { state: 'KNOWN_SUFFICIENT', raw: raw.toString() };
  return { state: 'KNOWN_INSUFFICIENT', raw: raw.toString() };
}

function rpcUrl(): string | null {
  return (
    process.env.ROBINHOOD_RPC_PRIMARY?.trim() ||
    process.env.RPC_URL?.trim() ||
    ROBINHOOD_CHAIN.rpcUrls.default.http[0] ||
    null
  );
}

export type UsdgStatus = {
  chainId: number;
  token: { address: `0x${string}`; decimals: number; symbol: string };
  spender: {
    address: `0x${string}` | null;
    source: 'seaport-direct' | 'conduit' | 'unresolved';
    conduitKey: string | null;
    note: string;
  };
  balance: AmountKnowledge;
  allowance: AmountKnowledge;
};

export async function readUsdgStatus(input: {
  buyerAddress: `0x${string}`;
  requiredRaw: bigint | null;
  conduitKey: string | null;
}): Promise<UsdgStatus> {
  const token = PAYMENT_TOKENS.USDG.contractAddress;
  const unresolved = {
    chainId: ROBINHOOD_CHAIN.id,
    token: { address: token, decimals: PAYMENT_TOKENS.USDG.decimals, symbol: 'USDG' },
    spender: {
      address: null as `0x${string}` | null,
      source: 'unresolved' as const,
      conduitKey: input.conduitKey,
      note: 'Cannot read allowance until conduitKey is resolved on-chain.',
    },
    balance: { state: 'UNKNOWN' as const, raw: null },
    allowance: { state: 'UNKNOWN' as const, raw: null },
  };
  let resolved;
  try {
    resolved = await resolveApprovalSpender(input.conduitKey);
  } catch (err) {
    return {
      ...unresolved,
      spender: {
        ...unresolved.spender,
        note: err instanceof Error ? err.message : String(err),
      },
    };
  }
  const url = rpcUrl();
  if (!url) {
    return {
      ...unresolved,
      spender: {
        address: resolved.spender,
        source: resolved.source,
        conduitKey: resolved.conduitKey,
        note: 'RPC missing; spender resolved but allowance unread.',
      },
    };
  }
  try {
    const client = createPublicClient({
      chain: ROBINHOOD_CHAIN,
      transport: http(url, { timeout: 12_000 }),
    });
    const [balance, allowance] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [input.buyerAddress],
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [input.buyerAddress, resolved.spender],
      }),
    ]);
    return {
      chainId: ROBINHOOD_CHAIN.id,
      token: { address: token, decimals: PAYMENT_TOKENS.USDG.decimals, symbol: 'USDG' },
      spender: {
        address: resolved.spender,
        source: resolved.source,
        conduitKey: resolved.conduitKey,
        note:
          resolved.source === 'conduit'
            ? 'USDG allowance spender is the Seaport conduit, not Seaport.'
            : 'Zero conduitKey: spender is Seaport itself.',
      },
      balance: classifyAmount(balance, input.requiredRaw),
      allowance: classifyAmount(allowance, input.requiredRaw),
    };
  } catch {
    return {
      ...unresolved,
      spender: {
        address: resolved.spender,
        source: resolved.source,
        conduitKey: resolved.conduitKey,
        note: 'Spender resolved; balance/allowance RPC read failed.',
      },
    };
  }
}
