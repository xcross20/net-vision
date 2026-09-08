import { describe, expect, it } from 'vitest';
import {
  ALLOWLISTED_PROTOCOLS,
  BUTTON_PRESSER_COLLECTION,
  isAllowlistedContract,
  isOfficialExistingTokenId,
} from '../src/index';

describe('chain-config', () => {
  it('allows the Button Presser contract', () => {
    expect(isAllowlistedContract(BUTTON_PRESSER_COLLECTION.contractAddress)).toBe(true);
    expect(isAllowlistedContract(BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase())).toBe(true);
  });

  it('allows the Seaport v1.5 protocol', () => {
    expect(isAllowlistedContract(ALLOWLISTED_PROTOCOLS.seaport15)).toBe(true);
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
