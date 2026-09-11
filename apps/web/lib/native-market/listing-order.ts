/**
 * Server-authoritative native listing parameters.
 *
 * The browser may propose price and duration. Recipients, conduit, chain,
 * collection, and fee split are determined here and re-checked on persist.
 */
import {
  ALLOWLISTED_PROTOCOLS,
  BUTTON_PRESSER_COLLECTION,
  isOfficialExistingTokenId,
  PAYMENT_TOKENS,
  ROBINHOOD_CHAIN,
  ZERO_CONDUIT_KEY,
} from '@net-vision/chain-config';
import { calculateNativeMarketplaceFee, parseUsdgDecimalToRaw, type MarketplaceFeeSplit } from './fees';

export const NATIVE_LISTING_ITEM_TYPE_ERC721 = 2;
export const NATIVE_LISTING_ITEM_TYPE_ERC20 = 1;
export const NATIVE_LISTING_ORDER_TYPE_FULL_OPEN = 0;
export const NATIVE_LISTING_MAX_DURATION_SECONDS = 90 * 24 * 60 * 60;
export const NATIVE_LISTING_MIN_DURATION_SECONDS = 15 * 60;

export type NativeListingConsideration = {
  itemType: number;
  token: `0x${string}`;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
  recipient: `0x${string}`;
};

export type NativeListingOfferItem = {
  itemType: number;
  token: `0x${string}`;
  identifierOrCriteria: string;
  startAmount: string;
  endAmount: string;
};

export type NativeListingParameters = {
  ecosystemId: 'helix';
  collectionId: 'button-presser';
  tokenId: string;
  offerer: `0x${string}`;
  chainId: number;
  protocolAddress: `0x${string}`;
  conduitKey: `0x${string}`;
  zone: `0x${string}`;
  startTime: number;
  endTime: number;
  salt: `0x${string}`;
  offer: NativeListingOfferItem[];
  consideration: NativeListingConsideration[];
  orderType: number;
  split: MarketplaceFeeSplit;
};

export type BuildNativeListingInput = {
  offerer: string;
  tokenId: string;
  priceUsdg: string;
  durationSeconds: number;
  feeRecipient: string;
  nowSeconds?: number;
  salt?: `0x${string}`;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

function asAddress(value: string, label: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`native-listing: invalid ${label}`);
  }
  return value.toLowerCase() as `0x${string}`;
}

export function buildNativeListingParameters(input: BuildNativeListingInput): NativeListingParameters {
  const tokenIdNum = Number(input.tokenId);
  if (!isOfficialExistingTokenId(tokenIdNum)) {
    throw new Error('native-listing: token is outside the official Button Presser universe');
  }
  if (
    input.durationSeconds < NATIVE_LISTING_MIN_DURATION_SECONDS ||
    input.durationSeconds > NATIVE_LISTING_MAX_DURATION_SECONDS
  ) {
    throw new Error('native-listing: duration out of range');
  }
  const offerer = asAddress(input.offerer, 'offerer');
  const feeRecipient = asAddress(input.feeRecipient, 'feeRecipient');
  if (feeRecipient === ZERO_ADDRESS) {
    throw new Error('native-listing: fee recipient is not configured');
  }
  const listingUsdgRaw = parseUsdgDecimalToRaw(input.priceUsdg);
  const split = calculateNativeMarketplaceFee(listingUsdgRaw);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const salt =
    input.salt ??
    (`0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}` as `0x${string}`);

  const offer: NativeListingOfferItem[] = [
    {
      itemType: NATIVE_LISTING_ITEM_TYPE_ERC721,
      token: BUTTON_PRESSER_COLLECTION.contractAddress,
      identifierOrCriteria: String(tokenIdNum),
      startAmount: '1',
      endAmount: '1',
    },
  ];
  const consideration: NativeListingConsideration[] = [
    {
      itemType: NATIVE_LISTING_ITEM_TYPE_ERC20,
      token: PAYMENT_TOKENS.USDG.contractAddress,
      identifierOrCriteria: '0',
      startAmount: split.sellerProceedsUsdgRaw.toString(),
      endAmount: split.sellerProceedsUsdgRaw.toString(),
      recipient: offerer,
    },
    {
      itemType: NATIVE_LISTING_ITEM_TYPE_ERC20,
      token: PAYMENT_TOKENS.USDG.contractAddress,
      identifierOrCriteria: '0',
      startAmount: split.marketplaceFeeUsdgRaw.toString(),
      endAmount: split.marketplaceFeeUsdgRaw.toString(),
      recipient: feeRecipient,
    },
  ];

  return {
    ecosystemId: 'helix',
    collectionId: 'button-presser',
    tokenId: String(tokenIdNum),
    offerer,
    chainId: ROBINHOOD_CHAIN.id,
    protocolAddress: ALLOWLISTED_PROTOCOLS.seaport16,
    conduitKey: ZERO_CONDUIT_KEY,
    zone: ZERO_ADDRESS,
    startTime: now,
    endTime: now + input.durationSeconds,
    salt,
    offer,
    consideration,
    orderType: NATIVE_LISTING_ORDER_TYPE_FULL_OPEN,
    split,
  };
}

export function assertNativeListingParameters(params: NativeListingParameters, expectedFeeRecipient: string): void {
  const feeRecipient = asAddress(expectedFeeRecipient, 'feeRecipient');
  if (params.chainId !== ROBINHOOD_CHAIN.id) throw new Error('native-listing: wrong chain');
  if (params.protocolAddress.toLowerCase() !== ALLOWLISTED_PROTOCOLS.seaport16.toLowerCase()) {
    throw new Error('native-listing: protocol is not allowlisted Seaport');
  }
  if (params.offer.length !== 1 || params.offer[0].token.toLowerCase() !== BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase()) {
    throw new Error('native-listing: offer is not the Button Presser');
  }
  if (params.consideration.length !== 2) throw new Error('native-listing: expected seller + marketplace consideration');
  if (params.consideration[0].recipient !== params.offerer) {
    throw new Error('native-listing: seller must receive proceeds');
  }
  if (params.consideration[1].recipient !== feeRecipient) {
    throw new Error('native-listing: marketplace fee recipient mismatch');
  }
  const seller = BigInt(params.consideration[0].startAmount);
  const fee = BigInt(params.consideration[1].startAmount);
  const recomputed = calculateNativeMarketplaceFee(seller + fee);
  if (recomputed.marketplaceFeeUsdgRaw !== fee || recomputed.sellerProceedsUsdgRaw !== seller) {
    throw new Error('native-listing: fee split does not match 0.5% policy');
  }
}
