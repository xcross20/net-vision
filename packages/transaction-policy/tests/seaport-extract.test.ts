import { describe, expect, it } from 'vitest';
import {
  calldataMentionsAddress,
  extractListingSemantics,
} from '../src/seaport-extract';
import { BUTTON_PRESSER_COLLECTION, PAYMENT_TOKENS } from '@net-vision/chain-config';

const BP = BUTTON_PRESSER_COLLECTION.contractAddress;
const USDG = PAYMENT_TOKENS.USDG.contractAddress;

describe('extractListingSemantics', () => {
  it('extracts token, collection, and payment from Seaport offer/consideration', () => {
    const semantics = extractListingSemantics({
      order_hash: '0xabc',
      protocol_address: '0x0000000000000068F116a894984e2DB1123eB395',
      protocol_data: {
        parameters: {
          offerer: '0x0000000000000000000000000000000000000abc',
          endTime: '2000000000',
          offer: [
            {
              itemType: 2,
              token: BP,
              identifierOrCriteria: '756',
              startAmount: '1',
              endAmount: '1',
            },
          ],
          consideration: [
            {
              itemType: 1,
              token: USDG,
              identifierOrCriteria: '0',
              startAmount: '643500',
              endAmount: '643500',
              recipient: '0x0000000000000000000000000000000000000abc',
            },
            {
              itemType: 1,
              token: USDG,
              identifierOrCriteria: '0',
              startAmount: '6500',
              endAmount: '6500',
              recipient: '0x0000a26b00c1f0df003000390027140000faa719',
            },
          ],
        },
      },
      price: { current: { currency: 'USDG', decimals: 6, value: '650000' } },
    });
    expect(semantics.tokenIds).toEqual(['756']);
    expect(semantics.collectionContracts[0]!.toLowerCase()).toBe(BP.toLowerCase());
    expect(semantics.paymentAmountRaw).toBe(650000n);
    expect(semantics.paymentTokenAddress).toBe(USDG.toLowerCase());
    expect(semantics.seller).toBe('0x0000000000000000000000000000000000000abc');
  });

  it('rejects offer for a non-Button-Presser collection', () => {
    expect(() =>
      extractListingSemantics({
        protocol_data: {
          parameters: {
            offer: [
              {
                itemType: 2,
                token: '0x0000000000000000000000000000000000000099',
                identifierOrCriteria: '1',
                startAmount: '1',
                endAmount: '1',
              },
            ],
            consideration: [
              {
                itemType: 1,
                token: USDG,
                startAmount: '100',
                endAmount: '100',
              },
            ],
          },
        },
      }),
    ).toThrow(/collection mismatch/);
  });
});

describe('calldataMentionsAddress', () => {
  it('finds padded address bytes in calldata', () => {
    const wallet = '0x0000000000000000000000000000000000000abc';
    const data = `0xdeadbeef0000000000000000000000000000000000000abc00ff`;
    expect(calldataMentionsAddress(data, wallet)).toBe(true);
    expect(calldataMentionsAddress(data, '0x0000000000000000000000000000000000000bad')).toBe(
      false,
    );
  });
});
