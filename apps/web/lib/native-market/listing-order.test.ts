import { describe, expect, it } from 'vitest';
import { ALLOWLISTED_PROTOCOLS, BUTTON_PRESSER_COLLECTION, PAYMENT_TOKENS } from '@net-vision/chain-config';
import { assertNativeListingParameters, buildNativeListingParameters } from './listing-order';

const FEE_RECIPIENT = '0x1111111111111111111111111111111111111111';
const SELLER = '0x2222222222222222222222222222222222222222';
const SALT = '0x3333333333333333333333333333333333333333333333333333333333333333' as const;

describe('native listing order builder', () => {
  it('builds a 0.5% split the browser cannot choose', () => {
    const params = buildNativeListingParameters({
      offerer: SELLER,
      tokenId: '966',
      priceUsdg: '500',
      durationSeconds: 7 * 24 * 60 * 60,
      feeRecipient: FEE_RECIPIENT,
      nowSeconds: 1_700_000_000,
      salt: SALT,
    });
    expect(params.chainId).toBe(4663);
    expect(params.protocolAddress).toBe(ALLOWLISTED_PROTOCOLS.seaport16);
    expect(params.offer[0].token).toBe(BUTTON_PRESSER_COLLECTION.contractAddress);
    expect(params.offer[0].identifierOrCriteria).toBe('966');
    expect(params.consideration[0].token.toLowerCase()).toBe(PAYMENT_TOKENS.USDG.contractAddress.toLowerCase());
    expect(params.consideration[0].recipient).toBe(SELLER.toLowerCase());
    expect(params.consideration[0].startAmount).toBe('497500000');
    expect(params.consideration[1].recipient).toBe(FEE_RECIPIENT);
    expect(params.consideration[1].startAmount).toBe('2500000');
    expect(params.endTime - params.startTime).toBe(7 * 24 * 60 * 60);
    assertNativeListingParameters(params, FEE_RECIPIENT);
  });

  it('rejects a client-modified fee recipient', () => {
    const params = buildNativeListingParameters({
      offerer: SELLER,
      tokenId: '966',
      priceUsdg: '100',
      durationSeconds: 3600,
      feeRecipient: FEE_RECIPIENT,
      salt: SALT,
    });
    params.consideration[1].recipient = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(() => assertNativeListingParameters(params, FEE_RECIPIENT)).toThrow(/fee recipient/);
  });

  it('rejects a client-modified fee amount', () => {
    const params = buildNativeListingParameters({
      offerer: SELLER,
      tokenId: '1',
      priceUsdg: '100',
      durationSeconds: 3600,
      feeRecipient: FEE_RECIPIENT,
      salt: SALT,
    });
    params.consideration[1].startAmount = '0';
    expect(() => assertNativeListingParameters(params, FEE_RECIPIENT)).toThrow(/0.5%/);
  });

  it('rejects unofficial token ids', () => {
    expect(() =>
      buildNativeListingParameters({
        offerer: SELLER,
        tokenId: '62094',
        priceUsdg: '100',
        durationSeconds: 3600,
        feeRecipient: FEE_RECIPIENT,
        salt: SALT,
      }),
    ).toThrow(/official/);
  });
});
