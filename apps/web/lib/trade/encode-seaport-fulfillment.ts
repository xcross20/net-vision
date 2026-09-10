/**
 * OpenSea v2 listing fulfillment_data.transaction is structured
 * (`function` + `input_data`), not a hex `data` field. We must encode
 * Seaport fulfillAdvancedOrder ourselves. Fail closed if the shape is
 * not the observed Robinhood listing form.
 */
import { encodeFunctionData, type Hex } from 'viem';

const FULFILL_ADVANCED_ORDER_ABI = [
  {
    type: 'function',
    name: 'fulfillAdvancedOrder',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'advancedOrder',
        type: 'tuple',
        components: [
          {
            name: 'parameters',
            type: 'tuple',
            components: [
              { name: 'offerer', type: 'address' },
              { name: 'zone', type: 'address' },
              {
                name: 'offer',
                type: 'tuple[]',
                components: [
                  { name: 'itemType', type: 'uint8' },
                  { name: 'token', type: 'address' },
                  { name: 'identifierOrCriteria', type: 'uint256' },
                  { name: 'startAmount', type: 'uint256' },
                  { name: 'endAmount', type: 'uint256' },
                ],
              },
              {
                name: 'consideration',
                type: 'tuple[]',
                components: [
                  { name: 'itemType', type: 'uint8' },
                  { name: 'token', type: 'address' },
                  { name: 'identifierOrCriteria', type: 'uint256' },
                  { name: 'startAmount', type: 'uint256' },
                  { name: 'endAmount', type: 'uint256' },
                  { name: 'recipient', type: 'address' },
                ],
              },
              { name: 'orderType', type: 'uint8' },
              { name: 'startTime', type: 'uint256' },
              { name: 'endTime', type: 'uint256' },
              { name: 'zoneHash', type: 'bytes32' },
              { name: 'salt', type: 'uint256' },
              { name: 'conduitKey', type: 'bytes32' },
              { name: 'totalOriginalConsiderationItems', type: 'uint256' },
            ],
          },
          { name: 'numerator', type: 'uint120' },
          { name: 'denominator', type: 'uint120' },
          { name: 'signature', type: 'bytes' },
          { name: 'extraData', type: 'bytes' },
        ],
      },
      {
        name: 'criteriaResolvers',
        type: 'tuple[]',
        components: [
          { name: 'orderIndex', type: 'uint256' },
          { name: 'side', type: 'uint8' },
          { name: 'index', type: 'uint256' },
          { name: 'identifier', type: 'uint256' },
          { name: 'criteriaProof', type: 'bytes32[]' },
        ],
      },
      { name: 'fulfillerConduitKey', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: 'fulfilled', type: 'bool' }],
  },
] as const;

export type EncodedFulfillment = {
  to: `0x${string}`;
  data: Hex;
  value: bigint;
  functionName: 'fulfillAdvancedOrder';
};

function asAddress(value: unknown, label: string): `0x${string}` {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`seaport-encode: invalid ${label}`);
  }
  return value.toLowerCase() as `0x${string}`;
}

function asHex(value: unknown, label: string): Hex {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]*$/.test(value)) {
    throw new Error(`seaport-encode: invalid ${label}`);
  }
  return value as Hex;
}

function asBigInt(value: unknown, label: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`seaport-encode: invalid ${label}`);
}

/**
 * Prefer a hex `data` field if OpenSea ever ships one. Otherwise encode
 * fulfillAdvancedOrder from `input_data`.
 */
export function encodeSeaportFulfillment(transaction: Record<string, unknown>): EncodedFulfillment {
  const to = asAddress(transaction.to, 'to');
  const valueRaw = transaction.value ?? transaction.value_hex ?? 0;
  const value =
    typeof valueRaw === 'string' && valueRaw.startsWith('0x')
      ? BigInt(valueRaw)
      : asBigInt(valueRaw === '' ? 0 : valueRaw, 'value');

  if (typeof transaction.data === 'string' && /^0x[a-fA-F0-9]+$/.test(transaction.data)) {
    return { to, data: transaction.data as Hex, value, functionName: 'fulfillAdvancedOrder' };
  }

  const fn = String(transaction.function ?? '');
  if (!fn.startsWith('fulfillAdvancedOrder')) {
    throw new Error(`seaport-encode: unsupported function ${fn || '(missing)'}`);
  }
  const input = transaction.input_data as Record<string, unknown> | undefined;
  if (!input || typeof input !== 'object') {
    throw new Error('seaport-encode: missing input_data');
  }
  const advanced = input.advancedOrder as Record<string, unknown> | undefined;
  const parameters = advanced?.parameters as Record<string, unknown> | undefined;
  if (!advanced || !parameters) {
    throw new Error('seaport-encode: missing advancedOrder.parameters');
  }
  const offer = (parameters.offer as unknown[]) ?? [];
  const consideration = (parameters.consideration as unknown[]) ?? [];
  const data = encodeFunctionData({
    abi: FULFILL_ADVANCED_ORDER_ABI,
    functionName: 'fulfillAdvancedOrder',
    args: [
      {
        parameters: {
          offerer: asAddress(parameters.offerer, 'offerer'),
          zone: asAddress(parameters.zone, 'zone'),
          offer: offer.map((item, i) => {
            const row = item as Record<string, unknown>;
            return {
              itemType: Number(row.itemType),
              token: asAddress(row.token, `offer[${i}].token`),
              identifierOrCriteria: asBigInt(row.identifierOrCriteria, `offer[${i}].id`),
              startAmount: asBigInt(row.startAmount, `offer[${i}].start`),
              endAmount: asBigInt(row.endAmount, `offer[${i}].end`),
            };
          }),
          consideration: consideration.map((item, i) => {
            const row = item as Record<string, unknown>;
            return {
              itemType: Number(row.itemType),
              token: asAddress(row.token, `consideration[${i}].token`),
              identifierOrCriteria: asBigInt(row.identifierOrCriteria, `consideration[${i}].id`),
              startAmount: asBigInt(row.startAmount, `consideration[${i}].start`),
              endAmount: asBigInt(row.endAmount, `consideration[${i}].end`),
              recipient: asAddress(row.recipient, `consideration[${i}].recipient`),
            };
          }),
          orderType: Number(parameters.orderType),
          startTime: asBigInt(parameters.startTime, 'startTime'),
          endTime: asBigInt(parameters.endTime, 'endTime'),
          zoneHash: asHex(parameters.zoneHash, 'zoneHash'),
          salt: asBigInt(parameters.salt, 'salt'),
          conduitKey: asHex(parameters.conduitKey, 'conduitKey'),
          totalOriginalConsiderationItems: asBigInt(
            parameters.totalOriginalConsiderationItems,
            'totalOriginalConsiderationItems',
          ),
        },
        numerator: asBigInt(advanced.numerator, 'numerator'),
        denominator: asBigInt(advanced.denominator, 'denominator'),
        signature: asHex(advanced.signature, 'signature'),
        extraData: asHex(advanced.extraData ?? '0x', 'extraData'),
      },
      [],
      asHex(input.fulfillerConduitKey, 'fulfillerConduitKey'),
      asAddress(input.recipient, 'recipient'),
    ],
  });
  return { to, data, value, functionName: 'fulfillAdvancedOrder' };
}
