/**
 * Server-authoritative Seaport bid (native offer).
 *
 * Buyer is offerer.
 * Offer: USDG (seller proceeds + 0.5% marketplace fee).
 * Consideration: Button Presser ERC721 to buyer, plus fee ERC20 to marketplace.
 * Remaining USDG goes to the seller as fulfiller.
 */
import {
  ALLOWLISTED_PROTOCOLS,
  PAYMENT_TOKENS,
  ROBINHOOD_CHAIN,
  ZERO_CONDUIT_KEY,
} from '@net-vision/chain-config';
import { hashTypedData, type Hex, type TypedDataDefinition } from 'viem';
import { calculateNativeMarketplaceFee } from '../native-market/fees';
import {
  NATIVE_LISTING_ITEM_TYPE_ERC20,
  NATIVE_LISTING_ITEM_TYPE_ERC721,
  NATIVE_LISTING_MAX_DURATION_SECONDS,
  NATIVE_LISTING_MIN_DURATION_SECONDS,
  NATIVE_LISTING_ORDER_TYPE_FULL_OPEN,
} from '../native-market/listing-order';
import { assetKey, buttonPresserContract, parseAssetIdentity, type AssetIdentity } from './identity';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export const SEAPORT_EIP712_TYPES = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' },
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
  ],
} as const;

export type SeaportOfferItem = {
  itemType: number;
  token: `0x${string}`;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
};

export type SeaportConsiderationItem = SeaportOfferItem & {
  recipient: `0x${string}`;
};

export type NativeOfferParameters = {
  identity: AssetIdentity;
  identityKey: string;
  offerer: `0x${string}`;
  chainId: number;
  protocolAddress: `0x${string}`;
  conduitKey: `0x${string}`;
  zone: `0x${string}`;
  zoneHash: `0x${string}`;
  startTime: number;
  endTime: number;
  salt: `0x${string}`;
  counter: string;
  orderType: number;
  offer: SeaportOfferItem[];
  consideration: SeaportConsiderationItem[];
  offerUsdgRaw: string;
  marketplaceFeeUsdgRaw: string;
  sellerProceedsUsdgRaw: string;
  marketplaceFeeRecipient: `0x${string}`;
};

export type BuildNativeOfferInput = {
  buyer: string;
  tokenId: string;
  ecosystemId?: string;
  collectionId?: string;
  offerUsdgRaw: bigint;
  durationSeconds: number;
  feeRecipient: string;
  nowSeconds?: number;
  salt?: `0x${string}`;
  counter?: bigint;
};

function asAddress(value: string, label: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`offer: invalid ${label}`);
  return value.toLowerCase() as `0x${string}`;
}

export function buildNativeOfferParameters(input: BuildNativeOfferInput): NativeOfferParameters {
  const identity = parseAssetIdentity({
    ecosystemId: input.ecosystemId,
    collectionId: input.collectionId,
    tokenId: input.tokenId,
  });
  if (
    input.durationSeconds < NATIVE_LISTING_MIN_DURATION_SECONDS ||
    input.durationSeconds > NATIVE_LISTING_MAX_DURATION_SECONDS
  ) {
    throw new Error('offer: duration out of range');
  }
  if (input.offerUsdgRaw <= 0n) throw new Error('offer: amount must be positive');
  const buyer = asAddress(input.buyer, 'buyer');
  const feeRecipient = asAddress(input.feeRecipient, 'feeRecipient');
  if (feeRecipient === ZERO_ADDRESS) throw new Error('offer: fee recipient is not configured');
  const split = calculateNativeMarketplaceFee(input.offerUsdgRaw);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const salt =
    input.salt ??
    (`0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`);
  const nft = buttonPresserContract();

  return {
    identity,
    identityKey: assetKey(identity),
    offerer: buyer,
    chainId: ROBINHOOD_CHAIN.id,
    protocolAddress: ALLOWLISTED_PROTOCOLS.seaport16,
    conduitKey: ZERO_CONDUIT_KEY,
    zone: ZERO_ADDRESS,
    zoneHash: ZERO_BYTES32,
    startTime: now,
    endTime: now + input.durationSeconds,
    salt,
    counter: (input.counter ?? 0n).toString(),
    orderType: NATIVE_LISTING_ORDER_TYPE_FULL_OPEN,
    offer: [
      {
        itemType: NATIVE_LISTING_ITEM_TYPE_ERC20,
        token: PAYMENT_TOKENS.USDG.contractAddress,
        identifierOrCriteria: '0',
        startAmount: split.listingUsdgRaw.toString(),
        endAmount: split.listingUsdgRaw.toString(),
      },
    ],
    consideration: [
      {
        itemType: NATIVE_LISTING_ITEM_TYPE_ERC721,
        token: nft,
        identifierOrCriteria: identity.tokenId,
        startAmount: '1',
        endAmount: '1',
        recipient: buyer,
      },
      {
        itemType: NATIVE_LISTING_ITEM_TYPE_ERC20,
        token: PAYMENT_TOKENS.USDG.contractAddress,
        identifierOrCriteria: '0',
        startAmount: split.marketplaceFeeUsdgRaw.toString(),
        endAmount: split.marketplaceFeeUsdgRaw.toString(),
        recipient: feeRecipient,
      },
    ],
    offerUsdgRaw: split.listingUsdgRaw.toString(),
    marketplaceFeeUsdgRaw: split.marketplaceFeeUsdgRaw.toString(),
    sellerProceedsUsdgRaw: split.sellerProceedsUsdgRaw.toString(),
    marketplaceFeeRecipient: feeRecipient,
  };
}

export function seaportTypedData(params: NativeOfferParameters): TypedDataDefinition {
  return {
    domain: {
      name: 'Seaport',
      version: '1.6',
      chainId: params.chainId,
      verifyingContract: params.protocolAddress,
    },
    types: SEAPORT_EIP712_TYPES,
    primaryType: 'OrderComponents',
    message: orderComponentsMessage(params),
  };
}

export function orderComponentsMessage(params: NativeOfferParameters) {
  return {
    offerer: params.offerer,
    zone: params.zone,
    offer: params.offer.map((item) => ({
      itemType: item.itemType,
      token: item.token,
      identifierOrCriteria: BigInt(item.identifierOrCriteria),
      startAmount: BigInt(item.startAmount),
      endAmount: BigInt(item.endAmount),
    })),
    consideration: params.consideration.map((item) => ({
      itemType: item.itemType,
      token: item.token,
      identifierOrCriteria: BigInt(item.identifierOrCriteria),
      startAmount: BigInt(item.startAmount),
      endAmount: BigInt(item.endAmount),
      recipient: item.recipient,
    })),
    orderType: params.orderType,
    startTime: BigInt(params.startTime),
    endTime: BigInt(params.endTime),
    zoneHash: params.zoneHash,
    salt: BigInt(params.salt),
    conduitKey: params.conduitKey,
    counter: BigInt(params.counter),
  };
}

export function computeOfferOrderHash(params: NativeOfferParameters): Hex {
  return hashTypedData(seaportTypedData(params));
}

export function jsonSafeTypedData(params: NativeOfferParameters): unknown {
  const typed = seaportTypedData(params);
  return JSON.parse(JSON.stringify(typed, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)));
}

export function assertMatchesPrepared(
  prepared: NativeOfferParameters,
  submitted: NativeOfferParameters,
  expectedFeeRecipient: string,
): void {
  const feeRecipient = asAddress(expectedFeeRecipient, 'feeRecipient');
  if (prepared.identityKey !== submitted.identityKey) throw new Error('offer: identity mismatch');
  if (prepared.offerer !== submitted.offerer) throw new Error('offer: buyer mismatch');
  if (prepared.chainId !== ROBINHOOD_CHAIN.id || submitted.chainId !== ROBINHOOD_CHAIN.id) {
    throw new Error('offer: wrong chain');
  }
  if (prepared.protocolAddress !== ALLOWLISTED_PROTOCOLS.seaport16) {
    throw new Error('offer: protocol is not allowlisted Seaport');
  }
  if (submitted.protocolAddress !== prepared.protocolAddress) throw new Error('offer: protocol mismatch');
  if (submitted.conduitKey !== prepared.conduitKey) throw new Error('offer: conduit mismatch');
  if (submitted.offerUsdgRaw !== prepared.offerUsdgRaw) throw new Error('offer: price mismatch');
  if (submitted.endTime !== prepared.endTime) throw new Error('offer: expiration mismatch');
  if (submitted.marketplaceFeeRecipient !== feeRecipient) throw new Error('offer: fee recipient mismatch');
  if (submitted.consideration[0]?.token.toLowerCase() !== buttonPresserContract().toLowerCase()) {
    throw new Error('offer: NFT contract mismatch');
  }
  if (submitted.consideration[0]?.identifierOrCriteria !== prepared.identity.tokenId) {
    throw new Error('offer: tokenId mismatch');
  }
  if (submitted.offer[0]?.token.toLowerCase() !== PAYMENT_TOKENS.USDG.contractAddress.toLowerCase()) {
    throw new Error('offer: USDG mismatch');
  }
  if (computeOfferOrderHash(submitted) !== computeOfferOrderHash(prepared)) {
    throw new Error('offer: order hash does not recompute to prepared authority');
  }
}
