import { UNISWAP_ROBINHOOD } from '@net-vision/chain-config';
import { getPaymentAsset } from '@net-vision/payment-router';
import { erc20Abi, type Address, type PublicClient } from 'viem';
import { encodeExactOutSwap, quoteExactOutToUsdg, tokenInForAsset } from './uniswap-exact-out';
import { robinhoodPublicClient } from './read-routed-wallet';

export async function prepareUsdgSwap(input: {
  buyer: Address;
  assetId: string;
  listingOrderHash: string;
  listingUsdgRaw: bigint;
}): Promise<{
  to: Address;
  data: `0x${string}`;
  value: bigint;
  amountInMaximum: bigint;
  tokenIn: Address;
  native: boolean;
}> {
  const asset = getPaymentAsset(input.assetId);
  if (!asset || input.assetId === 'usdg') {
    throw new Error('swap is only for routed rails');
  }
  const quoteRes = await fetch('/api/payment/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      buyer: input.buyer,
      assetId: input.assetId,
      listingOrderHash: input.listingOrderHash,
      listingUsdgRaw: input.listingUsdgRaw.toString(),
    }),
  });
  const json = (await quoteRes.json()) as {
    executable?: boolean;
    error?: string;
    quote?: { inputAmountRaw: string; requiredUsdgRaw: string; slippageBps: number };
  };
  if (!quoteRes.ok || !json.executable || !json.quote) {
    throw new Error(json.error ?? 'Could not quote this payment asset to USDG');
  }
  const client = robinhoodPublicClient();
  const required = BigInt(json.quote.requiredUsdgRaw);
  const dex = await quoteExactOutToUsdg({
    publicClient: client,
    tokenIn: tokenInForAsset(asset),
    amountOutUsdg: required,
    slippageBps: json.quote.slippageBps ?? 100,
  });
  const native = asset.kind === 'native';
  const encoded = encodeExactOutSwap({
    quote: dex,
    recipient: input.buyer,
    payNativeEth: native,
  });
  return {
    ...encoded,
    amountInMaximum: dex.amountInMaximum,
    tokenIn: dex.tokenIn,
    native,
  };
}

export async function ensureSwapAllowance(input: {
  token: Address;
  owner: Address;
  amount: bigint;
  publicClient: PublicClient;
  writeContract: (args: {
    address: Address;
    abi: typeof erc20Abi;
    functionName: 'approve';
    args: readonly [Address, bigint];
  }) => Promise<`0x${string}`>;
  wait: PublicClient['waitForTransactionReceipt'];
}): Promise<void> {
  const current = await input.publicClient.readContract({
    address: input.token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [input.owner, UNISWAP_ROBINHOOD.swapRouter02],
  });
  if (current >= input.amount) return;
  const hash = await input.writeContract({
    address: input.token,
    abi: erc20Abi,
    functionName: 'approve',
    args: [UNISWAP_ROBINHOOD.swapRouter02, input.amount],
  });
  const receipt = await input.wait({ hash });
  if (receipt.status !== 'success') {
    throw new Error('USDG swap allowance transaction reverted');
  }
}
