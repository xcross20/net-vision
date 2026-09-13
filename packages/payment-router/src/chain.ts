export const OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID = 4663;
export const OFFICIAL_ROBINHOOD_TESTNET_CHAIN_ID = 46630;

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
      : `configured chainId ${configuredChainId} does not match official mainnet ${OFFICIAL_ROBINHOOD_MAINNET_CHAIN_ID}`,
  };
}
