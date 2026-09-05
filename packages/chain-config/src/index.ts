/**
 * Net Vision chain and contract configuration.
 *
 * This module is the single source of truth for chain identifiers,
 * contract allowlists, and protocol addresses. Any executable action
 * must validate against these constants in the transaction policy engine.
 *
 * Robinhood Chain identifiers and the Button Presser contract below are
 * the only values the application may treat as authoritative. If the
 * official Robinhood Chain chain ID changes, update it here and bump
 * the CONFIG_VERSION constant.
 */
import { defineChain } from 'viem';

export const CONFIG_VERSION = 1;

export const BUTTON_PRESSER_COLLECTION = {
  name: 'Button Presser',
  openseaSlug: 'button-presser',
  contractAddress: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2' as const,
  tokenStandard: 'ERC721' as const,
  /**
   * Total on-chain supply range. The deterministic taxonomy enumerates
   * every token id in `[minTokenId, maxTokenId]` to compute category
   * membership. Update `maxTokenId` if the on-chain supply grows.
   */
  minTokenId: 1,
  maxTokenId: 62095,
} as const;

/**
 * Robinhood Chain.
 *
 * NOTE: The numeric chain ID below is the value documented at the time of
 * the v1.1 specification. The deployment pipeline must cross-check the
 * current official Robinhood Chain chain ID before any live trade is
 * enabled. See docs/integrations/opensea.md for the verification step.
 */
export const ROBINHOOD_CHAIN = defineChain({
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

/**
 * Allowlisted protocol addresses. The transaction policy engine must
 * reject any executable action whose target is not in this list.
 *
 * Seaport v1.5 is the OpenSea execution protocol used for ERC-721
 * orderbook fulfillment on supported chains.
 */
export const ALLOWLISTED_PROTOCOLS = {
  seaport15: '0x0000000000000068F116a894984e2DB1123eB395' as const,
} as const;

export const ALLOWLISTED_CONTRACT_SET = new Set<string>([
  BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
  ALLOWLISTED_PROTOCOLS.seaport15.toLowerCase(),
]);

export function isAllowlistedContract(address: string): boolean {
  return ALLOWLISTED_CONTRACT_SET.has(address.toLowerCase());
}

export function getChainId(): number {
  return ROBINHOOD_CHAIN.id;
}

/**
 * Display-only chain metadata for UI badges.
 */
export const CHAIN_DISPLAY = {
  id: ROBINHOOD_CHAIN.id,
  name: ROBINHOOD_CHAIN.name,
  shortName: 'Robinhood',
  explorerUrl: ROBINHOOD_CHAIN.blockExplorers.default.url,
} as const;
