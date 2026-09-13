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

export const CONFIG_VERSION = 2;

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
  /**
   * Discovery envelope for scans. Not the official existing supply —
   * two ids in this range do not exist on-chain (OpenSea/Plate total 62093).
   */
  maxTokenId: 62095,
  /** Sum of official Plate expected supplies. Use for coverage denominators. */
  officialExistingSupply: 62093,
} as const;

/**
 * Canonical market/category/supply universe. Discovery may persist
 * rows through `maxTokenId` (62094 and 62095 today), but listed counts,
 * coverage, and Items MUST NOT use COUNT(token_market_state).
 *
 * `tokens.exists` is an observation flag (metadata/NFT fetch), not
 * supply. Filtering `exists=true` would drop official ids that have
 * not been metadata-verified yet.
 */
export function isOfficialExistingTokenId(tokenId: number): boolean {
  return (
    Number.isInteger(tokenId) &&
    tokenId >= BUTTON_PRESSER_COLLECTION.minTokenId &&
    tokenId <= BUTTON_PRESSER_COLLECTION.officialExistingSupply
  );
}

/**
 * Robinhood Chain mainnet.
 *
 * Canonical record: `docs/launch/CHAIN_AUTHORITY.md` (2026-09-10).
 * Official docs + live RPC `eth_chainId` = 4663. The v1.1 value 1311 is retired.
 */
export const ROBINHOOD_CHAIN = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://rpc.mainnet.chain.robinhood.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Chain Explorer',
      url: 'https://robinhoodchain.blockscout.com',
    },
  },
});

/** 4663 as a 0x-prefixed hex string for wallet_switchEthereumChain. */
export const ROBINHOOD_CHAIN_ID_HEX = '0x1237' as const;

/**
 * Canonical wallet_addEthereumChain payload. RPC and explorer here are
 * the official public wallet defaults, not the app's production RPC.
 * Never construct this from URL params, OpenSea, or user-controlled data.
 */
export function robinhoodAddEthereumChainParameter(): {
  chainId: typeof ROBINHOOD_CHAIN_ID_HEX;
  chainName: typeof ROBINHOOD_CHAIN.name;
  nativeCurrency: {
    name: typeof ROBINHOOD_CHAIN.nativeCurrency.name;
    symbol: typeof ROBINHOOD_CHAIN.nativeCurrency.symbol;
    decimals: typeof ROBINHOOD_CHAIN.nativeCurrency.decimals;
  };
  rpcUrls: readonly string[];
  blockExplorerUrls: readonly string[];
} {
  return {
    chainId: ROBINHOOD_CHAIN_ID_HEX,
    chainName: ROBINHOOD_CHAIN.name,
    nativeCurrency: {
      name: ROBINHOOD_CHAIN.nativeCurrency.name,
      symbol: ROBINHOOD_CHAIN.nativeCurrency.symbol,
      decimals: ROBINHOOD_CHAIN.nativeCurrency.decimals,
    },
    rpcUrls: ROBINHOOD_CHAIN.rpcUrls.default.http,
    blockExplorerUrls: [ROBINHOOD_CHAIN.blockExplorers.default.url],
  };
}

/** OpenSea v2 path slug for this chain. Not a numeric id. */
export const OPENSEA_CHAIN_SLUG = 'robinhood' as const;

/**
 * Allowlisted protocol addresses. The transaction policy engine must
 * reject any executable action whose target is not in this list.
 *
 * Seaport at this address returns `information().version === "1.6"` on
 * Robinhood RPC. USDG allowance is NOT granted to Seaport when the
 * order's fulfillerConduitKey is non-zero — resolve the conduit via
 * ConduitController.getConduit(key) and approve that address.
 */
export const ALLOWLISTED_PROTOCOLS = {
  seaport16: '0x0000000000000068F116a894984e2DB1123eB395' as const,
  /** @deprecated same address as seaport16 */
  seaport15: '0x0000000000000068F116a894984e2DB1123eB395' as const,
  conduitController: '0x00000000F9490004C11Cef243f5400493c00Ad63' as const,
} as const;

export const ZERO_CONDUIT_KEY =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

/**
 * Settlement assets allowed for Button Presser purchases.
 * Always match by chainId + contractAddress — never by symbol alone.
 */
export const PAYMENT_TOKENS = {
  USDG: {
    symbol: 'USDG',
    chainId: ROBINHOOD_CHAIN.id,
    /** Observed on live button-presser Seaport consideration items. */
    contractAddress: '0x5fc5360d0400a0fd4f2af552add042d716f1d168' as const,
    decimals: 6,
  },
} as const;

export const ALLOWLISTED_PAYMENT_TOKEN_SET = new Set<string>(
  Object.values(PAYMENT_TOKENS).map((t) => t.contractAddress.toLowerCase()),
);

export const ALLOWLISTED_CONTRACT_SET = new Set<string>([
  BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase(),
  ALLOWLISTED_PROTOCOLS.seaport16.toLowerCase(),
  ALLOWLISTED_PROTOCOLS.conduitController.toLowerCase(),
  ...ALLOWLISTED_PAYMENT_TOKEN_SET,
]);

export function isAllowlistedContract(address: string): boolean {
  return ALLOWLISTED_CONTRACT_SET.has(address.toLowerCase());
}

export function isAllowlistedPaymentToken(address: string): boolean {
  return ALLOWLISTED_PAYMENT_TOKEN_SET.has(address.toLowerCase());
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
