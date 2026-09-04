/**
 * Robinhood Chain definition for wagmi.
 *
 * Mirrors `@net-vision/chain-config` but is exposed in a format the
 * wagmi/viem client libraries understand.
 */
import { defineChain } from 'viem';

export const robinhood = defineChain({
  id: 1311,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.robinhood.com/mainnet'],
    },
  },
  blockExplorers: {
    default: { name: 'Robinhood Explorer', url: 'https://explorer.robinhood.com' },
  },
});
