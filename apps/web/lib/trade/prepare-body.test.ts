import { describe, expect, it } from 'vitest';
import { BuyPrepareBody } from './prepare-body';

describe('BuyPrepareBody', () => {
  it('binds exact accepted order hash and price', () => {
    const parsed = BuyPrepareBody.parse({
      tokenId: '30781',
      buyerAddress: '0x0000000000000000000000000000000000000abc',
      acceptedPriceRaw: '1390000',
      acceptedOrderHash: '0x582079b0089145d2f5a84c4ea592797ed3f82dbaab395d0b942fd10ff7f1f7f3',
    });
    expect(parsed.acceptedPriceRaw).toBe('1390000');
    expect(parsed.acceptedOrderHash.startsWith('0x5820')).toBe(true);
  });

  it('rejects prepare without accepted order hash or price', () => {
    expect(
      BuyPrepareBody.safeParse({
        tokenId: '30781',
        buyerAddress: '0x0000000000000000000000000000000000000abc',
      }).success,
    ).toBe(false);
    expect(
      BuyPrepareBody.safeParse({
        tokenId: '30781',
        buyerAddress: '0x0000000000000000000000000000000000000abc',
        acceptedPriceRaw: '1390000',
      }).success,
    ).toBe(false);
  });
});
