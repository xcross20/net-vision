import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { ALLOWLISTED_PROTOCOLS, BUTTON_PRESSER_COLLECTION, PAYMENT_TOKENS } from '@net-vision/chain-config';
import { parseUsdgDecimalToRaw } from '../native-market/fees';
import {
  assertMatchesPrepared,
  buildNativeOfferParameters,
  computeOfferOrderHash,
  seaportTypedData,
} from './seaport-offer';
import { assetKey } from './identity';

const BUYER_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const FEE = '0x1111111111111111111111111111111111111111';
const SALT = '0x4444444444444444444444444444444444444444444444444444444444444444' as const;

describe('native Seaport offer (bid)', () => {
  it('is the reverse of a listing: buyer offers USDG, consideration is the NFT', () => {
    const buyer = privateKeyToAccount(BUYER_KEY).address.toLowerCase();
    const params = buildNativeOfferParameters({
      buyer,
      tokenId: '966',
      offerUsdgRaw: parseUsdgDecimalToRaw('100'),
      durationSeconds: 86400,
      feeRecipient: FEE,
      nowSeconds: 1_700_000_000,
      salt: SALT,
    });
    expect(params.identityKey).toBe(assetKey(params.identity));
    expect(params.offerer).toBe(buyer);
    expect(params.protocolAddress).toBe(ALLOWLISTED_PROTOCOLS.seaport16);
    expect(params.offer[0].token.toLowerCase()).toBe(PAYMENT_TOKENS.USDG.contractAddress.toLowerCase());
    expect(params.offer[0].startAmount).toBe(parseUsdgDecimalToRaw('100').toString());
    expect(params.consideration[0].token).toBe(BUTTON_PRESSER_COLLECTION.contractAddress);
    expect(params.consideration[0].identifierOrCriteria).toBe('966');
    expect(params.consideration[0].recipient).toBe(buyer);
    expect(params.consideration[1].recipient).toBe(FEE);
    expect(params.marketplaceFeeUsdgRaw).toBe(parseUsdgDecimalToRaw('0.5').toString());
    expect(params.sellerProceedsUsdgRaw).toBe(parseUsdgDecimalToRaw('99.5').toString());
  });

  it('rejects a client-modified price against prepared authority', () => {
    const buyer = privateKeyToAccount(BUYER_KEY).address.toLowerCase();
    const prepared = buildNativeOfferParameters({
      buyer,
      tokenId: '1',
      offerUsdgRaw: parseUsdgDecimalToRaw('10'),
      durationSeconds: 3600,
      feeRecipient: FEE,
      salt: SALT,
    });
    const tampered = {
      ...prepared,
      offerUsdgRaw: parseUsdgDecimalToRaw('1').toString(),
      offer: [{ ...prepared.offer[0], startAmount: '1', endAmount: '1' }],
    };
    expect(() => assertMatchesPrepared(prepared, tampered, FEE)).toThrow(/price mismatch|order hash/);
  });

  it('rejects unofficial token ids and wrong collection', () => {
    const buyer = privateKeyToAccount(BUYER_KEY).address.toLowerCase();
    expect(() =>
      buildNativeOfferParameters({
        buyer,
        tokenId: '62094',
        offerUsdgRaw: parseUsdgDecimalToRaw('10'),
        durationSeconds: 3600,
        feeRecipient: FEE,
        salt: SALT,
      }),
    ).toThrow(/official/);
    expect(() =>
      buildNativeOfferParameters({
        buyer,
        tokenId: '1',
        collectionId: 'gear',
        offerUsdgRaw: parseUsdgDecimalToRaw('10'),
        durationSeconds: 3600,
        feeRecipient: FEE,
        salt: SALT,
      }),
    ).toThrow(/collection/);
  });

  it('recovers the buyer from a Seaport typed-data signature', async () => {
    const account = privateKeyToAccount(BUYER_KEY);
    const params = buildNativeOfferParameters({
      buyer: account.address,
      tokenId: '333',
      offerUsdgRaw: parseUsdgDecimalToRaw('25'),
      durationSeconds: 3600,
      feeRecipient: FEE,
      nowSeconds: 1_700_000_000,
      salt: SALT,
    });
    const typed = seaportTypedData(params);
    const signature = await account.signTypedData(typed);
    const recovered = await recoverTypedDataAddress({
      ...typed,
      signature,
    });
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    expect(computeOfferOrderHash(params)).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
