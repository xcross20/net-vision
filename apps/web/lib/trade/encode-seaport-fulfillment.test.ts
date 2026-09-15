import { describe, expect, it } from 'vitest';
import { encodeSeaportFulfillment } from './encode-seaport-fulfillment';

const SEAPORT = '0x0000000000000068F116a894984e2DB1123eB395';

describe('encodeSeaportFulfillment', () => {
  it('encodes fulfillAdvancedOrder from OpenSea structured input_data', () => {
    const encoded = encodeSeaportFulfillment({
      function:
        'fulfillAdvancedOrder(((address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256),uint120,uint120,bytes,bytes),(uint256,uint8,uint256,uint256,bytes32[])[],bytes32,address)',
      chain: 4663,
      to: SEAPORT,
      value: '0',
      input_data: {
        advancedOrder: {
          parameters: {
            offerer: '0xbc912e32436bc919850798534a080a585d48d89c',
            zone: '0x000056f7000000ece9003ca63978907a00ffd100',
            offer: [
              {
                itemType: 2,
                token: '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2',
                identifierOrCriteria: '30781',
                startAmount: '1',
                endAmount: '1',
              },
            ],
            consideration: [
              {
                itemType: 1,
                token: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
                identifierOrCriteria: '0',
                startAmount: '1376100',
                endAmount: '1376100',
                recipient: '0xbc912e32436bc919850798534a080a585d48d89c',
              },
              {
                itemType: 1,
                token: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
                identifierOrCriteria: '0',
                startAmount: '13900',
                endAmount: '13900',
                recipient: '0x0000a26b00c1f0df003000390027140000faa719',
              },
            ],
            orderType: 3,
            startTime: '1',
            endTime: '2',
            zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            salt: '0',
            conduitKey: '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
            totalOriginalConsiderationItems: '2',
          },
          numerator: 1,
          denominator: 1,
          signature: '0x11',
          extraData: '0x',
        },
        criteriaResolvers: [],
        fulfillerConduitKey: '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
        recipient: '0x0000000000000000000000000000000000000abc',
      },
    });
    expect(encoded.to.toLowerCase()).toBe(SEAPORT.toLowerCase());
    expect(encoded.value).toBe(0n);
    expect(encoded.data.startsWith('0x')).toBe(true);
    expect(encoded.data.length).toBeGreaterThan(10);
    // Buyer dummy address appears in encoded calldata.
    expect(encoded.data.toLowerCase()).toContain('0000000000000000000000000000000000000abc');
    // Token id 30781.
    expect(encoded.data.toLowerCase()).toContain(BigInt(30781).toString(16));
    expect(encoded.recipientIsMsgSender).toBe(false);
  });

  it('encodes fulfillBasicOrder_efficient_6GL6yc from live OpenSea shape', () => {
    const encoded = encodeSeaportFulfillment({
      function:
        'fulfillBasicOrder_efficient_6GL6yc((address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes))',
      chain: 4663,
      to: SEAPORT,
      value: '0',
      input_data: {
        parameters: {
          considerationToken: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
          considerationIdentifier: '0',
          considerationAmount: '1346400',
          offerer: '0x52cf2c9f9057fbafd60debff7087101e97744637',
          zone: '0x0000000000000000000000000000000000000000',
          offerToken: '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2',
          offerIdentifier: '52985',
          offerAmount: '1',
          basicOrderType: 8,
          startTime: '1',
          endTime: '2',
          zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          salt: '1',
          offererConduitKey: '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
          fulfillerConduitKey: '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
          totalOriginalAdditionalRecipients: '1',
          additionalRecipients: [
            { amount: '13600', recipient: '0x0000a26b00c1f0df003000390027140000faa719' },
          ],
          signature: '0x11',
        },
      },
    });
    expect(encoded.functionName).toBe('fulfillBasicOrder_efficient_6GL6yc');
    expect(encoded.recipientIsMsgSender).toBe(true);
    expect(encoded.value).toBe(0n);
    expect(encoded.data.startsWith('0x00000000')).toBe(true);
    expect(encoded.data.toLowerCase()).toContain(BigInt(52985).toString(16));
    expect(encoded.data.toLowerCase()).toContain('5fc5360d0400a0fd4f2af552add042d716f1d168');
  });

  it('fails closed on non-efficient fulfillBasicOrder', () => {
    expect(() =>
      encodeSeaportFulfillment({
        function: 'fulfillBasicOrder((address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes))',
        chain: 4663,
        to: SEAPORT,
        value: '0',
        input_data: { parameters: { basicOrderType: 8 } },
      }),
    ).toThrow(/unsupported function/);
  });

  it('fails closed on ETH-to-ERC721 basicOrderType', () => {
    expect(() =>
      encodeSeaportFulfillment({
        function:
          'fulfillBasicOrder_efficient_6GL6yc((address,uint256,uint256,address,address,address,uint256,uint256,uint8,uint256,uint256,bytes32,uint256,bytes32,bytes32,uint256,(uint256,address)[],bytes))',
        chain: 4663,
        to: SEAPORT,
        value: '0',
        input_data: {
          parameters: {
            considerationToken: '0x0000000000000000000000000000000000000000',
            considerationIdentifier: '0',
            considerationAmount: '1',
            offerer: '0x52cf2c9f9057fbafd60debff7087101e97744637',
            zone: '0x0000000000000000000000000000000000000000',
            offerToken: '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2',
            offerIdentifier: '52985',
            offerAmount: '1',
            basicOrderType: 0,
            startTime: '1',
            endTime: '2',
            zoneHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            salt: '1',
            offererConduitKey: '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
            fulfillerConduitKey: '0x61159fefdfada89302ed55f8b9e89e2d67d8258712b3a3f89aa88525877f1d5e',
            totalOriginalAdditionalRecipients: '0',
            additionalRecipients: [],
            signature: '0x11',
          },
        },
      }),
    ).toThrow(/unsupported basicOrderType/);
  });

  it('fails closed when function is missing and data is not hex', () => {
    expect(() => encodeSeaportFulfillment({ to: SEAPORT, value: '0' })).toThrow(
      /missing input_data|unsupported function/,
    );
  });
});
