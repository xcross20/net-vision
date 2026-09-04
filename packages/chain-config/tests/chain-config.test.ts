import { describe, expect, it } from 'vitest';
import {
  ALLOWLISTED_PROTOCOLS,
  BUTTON_PRESSER_COLLECTION,
  isAllowlistedContract,
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
