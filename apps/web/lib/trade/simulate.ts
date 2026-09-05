/**
 * RPC simulation of a prepared trade transaction (eth_call).
 * Fail closed: if we cannot simulate, purchases must not proceed.
 */
import { createPublicClient, http, type Hex } from 'viem';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';

export type SimulationInput = {
  from: string;
  to: string;
  data?: string;
  value?: bigint;
};

export type SimulationResult = { ok: true } | { ok: false; detail: string };

function rpcUrl(): string | null {
  return (
    process.env.ROBINHOOD_RPC_PRIMARY?.trim() ||
    process.env.RPC_URL?.trim() ||
    ROBINHOOD_CHAIN.rpcUrls.default.http[0] ||
    null
  );
}

export async function simulateTradeTransaction(
  input: SimulationInput,
): Promise<SimulationResult> {
  const url = rpcUrl();
  if (!url) {
    return { ok: false, detail: 'no RPC URL configured for simulation' };
  }
  if (!input.data || !/^0x[a-fA-F0-9]*$/.test(input.data)) {
    return { ok: false, detail: 'missing or invalid transaction data' };
  }
  try {
    const client = createPublicClient({
      chain: ROBINHOOD_CHAIN,
      transport: http(url, { timeout: 12_000 }),
    });
    await client.call({
      account: input.from as Hex,
      to: input.to as Hex,
      data: input.data as Hex,
      value: input.value ?? 0n,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
