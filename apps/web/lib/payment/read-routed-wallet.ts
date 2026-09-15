import { UNISWAP_ROBINHOOD } from '@net-vision/chain-config';
import { createPublicClient, http, parseAbi, type Address, type PublicClient } from 'viem';
import { ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import type { AmountKnowledge } from './selected-payment-status';

const ERC20 = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

export function robinhoodPublicClient(): PublicClient {
  const url =
    process.env.ROBINHOOD_RPC_PRIMARY?.trim() ||
    process.env.RPC_URL?.trim() ||
    ROBINHOOD_CHAIN.rpcUrls.default.http[0];
  return createPublicClient({
    chain: ROBINHOOD_CHAIN,
    transport: http(url, { timeout: 12_000 }),
  });
}

function knowledge(raw: bigint, required: bigint | null): AmountKnowledge {
  if (required === null) return { state: 'KNOWN_SUFFICIENT', raw: raw.toString() };
  if (raw >= required) return { state: 'KNOWN_SUFFICIENT', raw: raw.toString() };
  return { state: 'KNOWN_INSUFFICIENT', raw: raw.toString() };
}

export async function readNativeBalance(
  buyer: Address,
  required: bigint | null,
  client: PublicClient,
): Promise<AmountKnowledge> {
  const raw = await client.getBalance({ address: buyer });
  return knowledge(raw, required);
}

export async function readErc20Balance(
  token: Address,
  buyer: Address,
  required: bigint | null,
  client: PublicClient,
): Promise<AmountKnowledge> {
  const raw = await client.readContract({
    address: token,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [buyer],
  });
  return knowledge(raw, required);
}

export async function readErc20Allowance(
  token: Address,
  buyer: Address,
  required: bigint | null,
  client: PublicClient,
): Promise<AmountKnowledge> {
  const raw = await client.readContract({
    address: token,
    abi: ERC20,
    functionName: 'allowance',
    args: [buyer, UNISWAP_ROBINHOOD.swapRouter02],
  });
  return knowledge(raw, required);
}
