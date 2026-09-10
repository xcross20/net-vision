/**
 * Official Robinhood Chain mainnet per docs.robinhood.com/chain/connecting
 * (retrieved 2026-09-10): Chain ID 4663, explorer robinhoodchain.blockscout.com.
 *
 * Net Vision still encodes 1311 in @net-vision/chain-config from the v1.1 spec.
 * Fletcher live GET /config returns chainId 4663 and the same USDG address.
 *
 * Do not copy Fletcher or third-party router addresses onto 1311.
 * Do not enable a swap route until expectedChainId matches a live RPC eth_chainId
 * AND OpenSea fulfillment chain_id for Button Presser.
 */

export const OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const OFFICIAL_ROBINHOOD_TESTNET_CHAIN_ID = 46630;

export const USDG_1311_AND_4663 = '0x5fc5360d0400a0fd4f2af552add042d716f1d168' as const;

export type ChainIdCheck = {
  configuredChainId: number;
  officialMainnetChainId: number;
  matchesOfficialMainnet: boolean;
  detail: string;
};

export function checkConfiguredChainId(configuredChainId: number): ChainIdCheck {
  const matches = configuredChainId === OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID;
  return {
    configuredChainId,
    officialMainnetChainId: OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID,
    matchesOfficialMainnet: matches,
    detail: matches
      ? 'configured chainId matches official Robinhood mainnet 4663'
      : `configured chainId ${configuredChainId} does not match official mainnet ${OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID}; swap routes stay disabled`,
  };
}
