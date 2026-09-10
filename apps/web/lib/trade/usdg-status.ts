/**
 * USDG balance/allowance knowledge. Unknown must never render as 0.
 */
import { createPublicClient, http, erc20Abi } from 'viem';
import {
  ALLOWLISTED_PROTOCOLS,
  PAYMENT_TOKENS,
  ROBINHOOD_CHAIN,
} from '@net-vision/chain-config';

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
    address: `0x${string}`;
    source: 'seaport-allowlist-provisional';
    note: string;
  };
  balance: AmountKnowledge;
  allowance: AmountKnowledge;
};

export async function readUsdgStatus(input: {
  buyerAddress: `0x${string}`;
  requiredRaw: bigint | null;
}): Promise<UsdgStatus> {
  const token = PAYMENT_TOKENS.USDG.contractAddress;
  const spender = ALLOWLISTED_PROTOCOLS.seaport15;
  const base = {
    chainId: ROBINHOOD_CHAIN.id,
    token: { address: token, decimals: PAYMENT_TOKENS.USDG.decimals, symbol: 'USDG' },
    spender: {
      address: spender,
      source: 'seaport-allowlist-provisional' as const,
      note: 'Spender is Seaport v1.5 until a live fulfillment payload names a conduit. Do not treat this as proven.',
    },
  };
  const url = rpcUrl();
  if (!url) {
    return {
      ...base,
      balance: { state: 'UNKNOWN', raw: null },
      allowance: { state: 'UNKNOWN', raw: null },
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
        args: [input.buyerAddress, spender],
      }),
    ]);
    return {
      ...base,
      balance: classifyAmount(balance, input.requiredRaw),
      allowance: classifyAmount(allowance, input.requiredRaw),
    };
  } catch {
    return {
      ...base,
      balance: { state: 'UNKNOWN', raw: null },
      allowance: { state: 'UNKNOWN', raw: null },
    };
  }
}
