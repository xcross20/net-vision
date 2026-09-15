/**
 * Exact-out quotes and SwapRouter02 calldata: input asset → USDG on 4663.
 */
import { PAYMENT_TOKENS, UNISWAP_ROBINHOOD } from '@net-vision/chain-config';
import { encodeFunctionData, parseAbi, type Address, type PublicClient } from 'viem';

export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

const QUOTER_ABI = parseAbi([
  'function quoteExactOutputSingle((address tokenIn, address tokenOut, uint256 amount, uint24 fee, uint160 sqrtPriceLimitX96) params) view returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const SWAP_ROUTER_ABI = parseAbi([
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)',
  'function refundETH()',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
]);

export type ExactOutQuote = {
  tokenIn: Address;
  fee: number;
  amountIn: bigint;
  amountOut: bigint;
  amountInMaximum: bigint;
};

export function tokenInForAsset(asset: {
  kind: string;
  contractAddress?: string;
}): Address {
  if (asset.kind === 'native') return UNISWAP_ROBINHOOD.weth;
  if (!asset.contractAddress) {
    throw new Error('routed asset missing contract');
  }
  return asset.contractAddress as Address;
}

export async function quoteExactOutToUsdg(input: {
  publicClient: PublicClient;
  tokenIn: Address;
  amountOutUsdg: bigint;
  slippageBps: number;
}): Promise<ExactOutQuote> {
  const usdg = PAYMENT_TOKENS.USDG.contractAddress as Address;
  let best: { fee: number; amountIn: bigint } | null = null;
  for (const fee of V3_FEE_TIERS) {
    try {
      const result = await input.publicClient.readContract({
        address: UNISWAP_ROBINHOOD.quoterV2,
        abi: QUOTER_ABI,
        functionName: 'quoteExactOutputSingle',
        args: [
          {
            tokenIn: input.tokenIn,
            tokenOut: usdg,
            amount: input.amountOutUsdg,
            fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });
      const amountIn = result[0];
      if (!best || amountIn < best.amountIn) best = { fee, amountIn };
    } catch {
      /* no pool at this fee */
    }
  }
  if (!best) throw new Error('NO_UNISWAP_ROUTE');
  const amountInMaximum =
    (best.amountIn * (10_000n + BigInt(input.slippageBps))) / 10_000n;
  return {
    tokenIn: input.tokenIn,
    fee: best.fee,
    amountIn: best.amountIn,
    amountOut: input.amountOutUsdg,
    amountInMaximum,
  };
}

export function encodeExactOutSwap(input: {
  quote: ExactOutQuote;
  recipient: Address;
  payNativeEth: boolean;
}): { to: Address; data: `0x${string}`; value: bigint } {
  const usdg = PAYMENT_TOKENS.USDG.contractAddress as Address;
  const single = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactOutputSingle',
    args: [
      {
        tokenIn: input.quote.tokenIn,
        tokenOut: usdg,
        fee: input.quote.fee,
        recipient: input.recipient,
        amountOut: input.quote.amountOut,
        amountInMaximum: input.quote.amountInMaximum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  if (!input.payNativeEth) {
    return {
      to: UNISWAP_ROBINHOOD.swapRouter02,
      data: single,
      value: 0n,
    };
  }
  const refund = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'refundETH',
  });
  const data = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: 'multicall',
    args: [[single, refund]],
  });
  return {
    to: UNISWAP_ROBINHOOD.swapRouter02,
    data,
    value: input.quote.amountInMaximum,
  };
}
