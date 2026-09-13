import { recoverTypedDataAddress, type Hex } from 'viem';
import { formatUsdgRaw } from '../native-market/fees';
import { encodeSeaportCancel } from './cancel';
import { assertOfferCapacity } from './exposure';
import {
  assertMatchesPrepared,
  buildNativeOfferParameters,
  computeOfferOrderHash,
  jsonSafeTypedData,
  seaportTypedData,
  type NativeOfferParameters,
} from './seaport-offer';
import {
  getMemoryOfferStore,
  newGroupId,
  newOfferId,
  type NativeOfferStore,
  type StoredNativeOffer,
} from './store';
import { assertCanMarkCancelled, assertCanMarkFilled } from './status';

export function configuredFeeRecipient(): `0x${string}` | null {
  const value = process.env.NET_VISION_MARKETPLACE_FEE_RECIPIENT?.trim();
  return value && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value.toLowerCase() as `0x${string}`)
    : null;
}

export function getOfferStore(): NativeOfferStore {
  return getMemoryOfferStore();
}

export async function prepareNativeOffer(input: {
  buyer: string;
  tokenId: string;
  ecosystemId?: string;
  collectionId?: string;
  offerUsdgRaw: bigint;
  durationSeconds: number;
  balanceUsdgRaw: bigint;
  store?: NativeOfferStore;
  feeRecipient?: string;
  offerGroupId?: string | null;
}): Promise<{ id: string; parameters: NativeOfferParameters; typedData: unknown; review: Record<string, string> }> {
  const feeRecipient = input.feeRecipient ?? configuredFeeRecipient();
  if (!feeRecipient) throw new Error('offer: NET_VISION_MARKETPLACE_FEE_RECIPIENT is required');
  const store = input.store ?? getOfferStore();
  const existing = await store.activeExposure(input.buyer);
  assertOfferCapacity({
    balanceUsdgRaw: input.balanceUsdgRaw,
    existingActiveExposureUsdgRaw: existing,
    newLiabilityUsdgRaw: input.offerUsdgRaw,
  });
  const parameters = buildNativeOfferParameters({
    buyer: input.buyer,
    tokenId: input.tokenId,
    ecosystemId: input.ecosystemId,
    collectionId: input.collectionId,
    offerUsdgRaw: input.offerUsdgRaw,
    durationSeconds: input.durationSeconds,
    feeRecipient,
  });
  const id = newOfferId();
  const hash = computeOfferOrderHash(parameters);
  await store.putDraft({
    id,
    offerGroupId: input.offerGroupId ?? null,
    parameters,
    seaportOrderHash: hash,
    signature: null,
    status: 'DRAFT',
    createdAt: Date.now(),
  });
  return {
    id,
    parameters,
    typedData: jsonSafeTypedData(parameters),
    review: {
      tokenId: parameters.identity.tokenId,
      offer: `${formatUsdgRaw(BigInt(parameters.offerUsdgRaw))} USDG`,
      marketplaceFee: `${formatUsdgRaw(BigInt(parameters.marketplaceFeeUsdgRaw))} USDG (0.5%)`,
      sellerReceives: `${formatUsdgRaw(BigInt(parameters.sellerProceedsUsdgRaw))} USDG`,
      expiresAt: String(parameters.endTime),
    },
  };
}

export async function submitNativeOffer(input: {
  offerId: string;
  buyer: string;
  signature: Hex;
  submitted?: NativeOfferParameters;
  store?: NativeOfferStore;
  feeRecipient?: string;
}): Promise<StoredNativeOffer> {
  const feeRecipient = input.feeRecipient ?? configuredFeeRecipient();
  if (!feeRecipient) throw new Error('offer: NET_VISION_MARKETPLACE_FEE_RECIPIENT is required');
  const store = input.store ?? getOfferStore();
  const draft = await store.get(input.offerId);
  if (!draft) throw new Error('offer: unknown prepare id');
  if (draft.status !== 'DRAFT') throw new Error('offer: not a draft');
  if (draft.parameters.offerer !== input.buyer.toLowerCase()) throw new Error('offer: buyer mismatch');
  const submitted = input.submitted ?? draft.parameters;
  assertMatchesPrepared(draft.parameters, submitted, feeRecipient);
  const recovered = await recoverTypedDataAddress({
    ...seaportTypedData(draft.parameters),
    signature: input.signature,
  });
  if (recovered.toLowerCase() !== draft.parameters.offerer) {
    throw new Error('offer: signature does not recover buyer');
  }
  const hash = computeOfferOrderHash(draft.parameters);
  await store.setSignature(input.offerId, input.signature, hash);
  const saved = await store.get(input.offerId);
  if (!saved) throw new Error('offer: persist failed');
  return saved;
}

export async function prepareAcceptNativeOffer(input: {
  offerId: string;
  seller: string;
  sellerOwnsToken: boolean;
  buyerBalanceUsdgRaw: bigint;
  nowSeconds?: number;
  store?: NativeOfferStore;
}): Promise<{ offer: StoredNativeOffer; message: string }> {
  const store = input.store ?? getOfferStore();
  const offer = await store.get(input.offerId);
  if (!offer) throw new Error('offer: not found');
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (offer.status !== 'ACTIVE') throw new Error('offer: not ACTIVE');
  if (now >= offer.parameters.endTime) throw new Error('offer: expired');
  if (!offer.signature) throw new Error('offer: missing signature');
  if (!input.sellerOwnsToken) throw new Error('offer: seller does not own NFT');
  if (input.buyerBalanceUsdgRaw < BigInt(offer.parameters.offerUsdgRaw)) {
    throw new Error('offer: buyer has insufficient USDG');
  }
  return {
    offer,
    message:
      'Accept fulfillment encoding is prepared against the stored native Seaport bid. Seller must sign the returned Seaport cancel/fulfill path from a later live executor slice.',
  };
}

export async function prepareCancelNativeOffers(input: {
  offerIds: string[];
  buyer: string;
  store?: NativeOfferStore;
}): Promise<{ to: `0x${string}`; data: Hex; value: '0'; offerIds: string[] }> {
  const store = input.store ?? getOfferStore();
  const orders: NativeOfferParameters[] = [];
  for (const id of input.offerIds) {
    const offer = await store.get(id);
    if (!offer) throw new Error('offer: not found');
    if (offer.parameters.offerer !== input.buyer.toLowerCase()) throw new Error('offer: buyer mismatch');
    if (offer.status !== 'ACTIVE') throw new Error('offer: not ACTIVE');
    orders.push(offer.parameters);
  }
  return { ...encodeSeaportCancel(orders), offerIds: input.offerIds };
}

export async function confirmCancelNativeOffers(input: {
  offerIds: string[];
  receiptStatus: 'success' | 'reverted' | 'unknown';
  store?: NativeOfferStore;
}): Promise<void> {
  const store = input.store ?? getOfferStore();
  for (const id of input.offerIds) {
    const offer = await store.get(id);
    if (!offer) throw new Error('offer: not found');
    assertCanMarkCancelled({ status: offer.status, cancelReceiptStatus: input.receiptStatus });
    await store.setStatus(id, 'CANCELLED');
    if (offer.offerGroupId) await store.refreshGroupStatus(offer.offerGroupId);
  }
}

export async function confirmFillNativeOffer(input: {
  offerId: string;
  receiptStatus: 'success' | 'reverted' | 'unknown';
  store?: NativeOfferStore;
}): Promise<void> {
  const store = input.store ?? getOfferStore();
  const offer = await store.get(input.offerId);
  if (!offer) throw new Error('offer: not found');
  assertCanMarkFilled({ status: offer.status, receiptStatus: input.receiptStatus });
  await store.setStatus(input.offerId, 'FILLED');
  if (offer.offerGroupId) await store.refreshGroupStatus(offer.offerGroupId);
}

export { newGroupId, newOfferId };
