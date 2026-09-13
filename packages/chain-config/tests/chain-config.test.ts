import { describe, expect, it } from 'vitest';
import {
  ALLOWLISTED_PROTOCOLS,
  BUTTON_PRESSER_COLLECTION,
  OPENSEA_CHAIN_SLUG,
  PAYMENT_TOKENS,
  ROBINHOOD_CHAIN,
  ROBINHOOD_CHAIN_ID_HEX,
  isAllowlistedContract,
  isOfficialExistingTokenId,
  robinhoodAddEthereumChainParameter,
} from '../src/index';

describe('chain-config', () => {
  it('canonical mainnet chain id is official 4663', () => {
    expect(ROBINHOOD_CHAIN.id).toBe(4663);
    expect(PAYMENT_TOKENS.USDG.chainId).toBe(ROBINHOOD_CHAIN.id);
    expect(ROBINHOOD_CHAIN.rpcUrls.default.http[0]).toBe(
      'https://rpc.mainnet.chain.robinhood.com',
    );
    expect(ROBINHOOD_CHAIN.blockExplorers.default.url).toContain('blockscout.com');
    expect(OPENSEA_CHAIN_SLUG).toBe('robinhood');
  });

  it('wallet add/switch payload is derived from ROBINHOOD_CHAIN only', () => {
    expect(ROBINHOOD_CHAIN_ID_HEX).toBe('0x1237');
    expect(Number.parseInt(ROBINHOOD_CHAIN_ID_HEX, 16)).toBe(ROBINHOOD_CHAIN.id);
    const params = robinhoodAddEthereumChainParameter();
    expect(params.chainId).toBe(ROBINHOOD_CHAIN_ID_HEX);
    expect(params.chainName).toBe(ROBINHOOD_CHAIN.name);
    expect(params.nativeCurrency).toEqual(ROBINHOOD_CHAIN.nativeCurrency);
    expect(params.rpcUrls).toEqual(ROBINHOOD_CHAIN.rpcUrls.default.http);
    expect(params.blockExplorerUrls).toEqual([ROBINHOOD_CHAIN.blockExplorers.default.url]);
  });

  it('allows the Button Presser contract', () => {
    expect(isAllowlistedContract(BUTTON_PRESSER_COLLECTION.contractAddress)).toBe(true);
    expect(isAllowlistedContract(BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase())).toBe(true);
  });

  it('allows Seaport 1.6 and the canonical ConduitController', () => {
    expect(ALLOWLISTED_PROTOCOLS.seaport16).toBe(ALLOWLISTED_PROTOCOLS.seaport15);
    expect(isAllowlistedContract(ALLOWLISTED_PROTOCOLS.seaport16)).toBe(true);
    expect(isAllowlistedContract(ALLOWLISTED_PROTOCOLS.conduitController)).toBe(true);
  });

  it('rejects unknown contracts', () => {
    expect(isAllowlistedContract('0x0000000000000000000000000000000000000001')).toBe(false);
    expect(isAllowlistedContract('not-an-address')).toBe(false);
  });
});

describe('isOfficialExistingTokenId', () => {
  it('includes the official Plate range and excludes discovery-envelope phantoms', () => {
    expect(isOfficialExistingTokenId(1)).toBe(true);
    expect(isOfficialExistingTokenId(62093)).toBe(true);
    expect(isOfficialExistingTokenId(62094)).toBe(false);
    expect(isOfficialExistingTokenId(62095)).toBe(false);
    expect(BUTTON_PRESSER_COLLECTION.maxTokenId - BUTTON_PRESSER_COLLECTION.officialExistingSupply).toBe(2);
  });

  it('must not treat COUNT of the discovery envelope as supply', () => {
    expect(BUTTON_PRESSER_COLLECTION.officialExistingSupply).not.toBe(BUTTON_PRESSER_COLLECTION.maxTokenId);
    expect(BUTTON_PRESSER_COLLECTION.officialExistingSupply).toBe(62093);
  });
});
