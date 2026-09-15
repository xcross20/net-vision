import { describe, expect, it } from 'vitest';
import { UNISWAP_ROBINHOOD } from '@net-vision/chain-config';
import { encodeExactOutSwap, tokenInForAsset } from './uniswap-exact-out';

describe('uniswap exact-out', () => {
  it('maps native ETH to WETH', () => {
    expect(tokenInForAsset({ kind: 'native' }).toLowerCase()).toBe(
      UNISWAP_ROBINHOOD.weth.toLowerCase(),
    );
  });

  it('encodes a payable multicall for native ETH', () => {
    const encoded = encodeExactOutSwap({
      quote: {
        tokenIn: UNISWAP_ROBINHOOD.weth,
        fee: 100,
        amountIn: 1n,
        amountOut: 1_430_000n,
        amountInMaximum: 2n,
      },
      recipient: '0x0000000000000000000000000000000000000abc',
      payNativeEth: true,
    });
    expect(encoded.to.toLowerCase()).toBe(UNISWAP_ROBINHOOD.swapRouter02.toLowerCase());
    expect(encoded.value).toBe(2n);
    expect(encoded.data.startsWith('0x')).toBe(true);
  });
});
