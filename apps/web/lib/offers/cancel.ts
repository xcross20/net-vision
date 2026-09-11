import { encodeFunctionData, type Hex } from 'viem';
import { ALLOWLISTED_PROTOCOLS } from '@net-vision/chain-config';
import { orderComponentsMessage, type NativeOfferParameters } from './seaport-offer';

const CANCEL_ABI = [
  {
    type: 'function',
    name: 'cancel',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'orders',
        type: 'tuple[]',
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
          { name: 'counter', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'cancelled', type: 'bool' }],
  },
] as const;

export function encodeSeaportCancel(orders: NativeOfferParameters[]): {
  to: `0x${string}`;
  data: Hex;
  value: '0';
} {
  if (orders.length === 0) throw new Error('offer: no orders to cancel');
  return {
    to: ALLOWLISTED_PROTOCOLS.seaport16,
    data: encodeFunctionData({
      abi: CANCEL_ABI,
      functionName: 'cancel',
      args: [orders.map((params) => orderComponentsMessage(params))],
    }),
    value: '0',
  };
}
