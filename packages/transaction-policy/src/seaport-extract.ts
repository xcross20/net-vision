/**
 * Independently extract Seaport listing semantics from OpenSea order
 * protocol_data — never from user intent.
 *
 * Listing shape (observed on button-presser / Robinhood):
 *   offer[]         ERC721 item(s) the seller provides
 *   consideration[] ERC20/native payments (seller + fees)
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';

export const SEAPORT_ITEM_NATIVE = 0;
export const SEAPORT_ITEM_ERC20 = 1;
export const SEAPORT_ITEM_ERC721 = 2;
export const SEAPORT_ITEM_ERC1155 = 3;

export type SeaportOfferItem = {
  itemType: number;
  token?: string;
  identifierOrCriteria?: string | number;
  startAmount?: string | number;
  endAmount?: string | number;
  recipient?: string;
};

export type ExtractedListingSemantics = {
  tokenIds: string[];
  collectionContracts: string[];
  seller: string | null;
  /** Sum of ERC20/native consideration startAmounts (buyer total spend). */
  paymentAmountRaw: bigint;
  paymentTokenAddress: string | null;
  paymentIsNative: boolean;
  orderExpiry: number | null;
  orderHash: string | null;
  protocolAddress: string | null;
};

function asAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function asTokenId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return null;
}

function asBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return null;
}

function parseEpoch(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

/**
 * Extract buy-side semantics from a listing Order (OpenSea v2 shape).
 * Throws if the order cannot be decoded into a Button Presser ERC-721 sale.
 */
export function extractListingSemantics(order: {
  order_hash?: string;
  protocol_address?: string;
  protocol_data?: {
    parameters?: {
      offerer?: string;
      offer?: SeaportOfferItem[];
      consideration?: SeaportOfferItem[];
      endTime?: string | number;
    };
  };
  asset?: { identifier?: string | number; contract?: string };
  price?: { current?: { value?: string | number; currency?: string; decimals?: number } };
}): ExtractedListingSemantics {
  const params = order.protocol_data?.parameters;
  if (!params) {
    throw new Error('seaport-extract: missing protocol_data.parameters');
  }

  const offer = params.offer ?? [];
  const consideration = params.consideration ?? [];
  const collection = BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase();

  const tokenIds: string[] = [];
  const collectionContracts: string[] = [];

  for (const item of offer) {
    if (item.itemType !== SEAPORT_ITEM_ERC721 && item.itemType !== SEAPORT_ITEM_ERC1155) continue;
    const token = asAddress(item.token);
    const id = asTokenId(item.identifierOrCriteria);
    if (!token || !id) continue;
    collectionContracts.push(token);
    tokenIds.push(id);
  }

  // Fallback: top-level asset block (still from OpenSea order, not user intent).
  if (tokenIds.length === 0 && order.asset) {
    const id = asTokenId(order.asset.identifier);
    const token = asAddress(order.asset.contract);
    if (id && token) {
      tokenIds.push(id);
      collectionContracts.push(token);
    }
  }

  if (tokenIds.length === 0) {
    throw new Error('seaport-extract: no ERC721/1155 offer items found');
  }
  if (!collectionContracts.every((c) => c === collection)) {
    throw new Error(
      `seaport-extract: offer collection mismatch expected=${collection} got=${collectionContracts.join(',')}`,
    );
  }

  // Buyer payment = sum of ERC20/native consideration amounts (seller + fees).
  let paymentTokenAddress: string | null = null;
  let paymentIsNative = false;
  let paymentAmountRaw = 0n;
  for (const item of consideration) {
    if (item.itemType === SEAPORT_ITEM_NATIVE) {
      paymentIsNative = true;
      paymentTokenAddress = '0x0000000000000000000000000000000000000000';
      const amt = asBigInt(item.startAmount) ?? 0n;
      paymentAmountRaw += amt;
      continue;
    }
    if (item.itemType === SEAPORT_ITEM_ERC20) {
      const token = asAddress(item.token);
      if (!token) continue;
      if (paymentTokenAddress && paymentTokenAddress !== token) {
        throw new Error('seaport-extract: multiple ERC20 payment tokens in consideration');
      }
      paymentTokenAddress = token;
      paymentAmountRaw += asBigInt(item.startAmount) ?? 0n;
    }
  }

  // Cross-check OpenSea price envelope when present.
  const envelope = order.price?.current?.value;
  const envelopeRaw = asBigInt(envelope);
  if (envelopeRaw !== null && paymentAmountRaw > 0n && envelopeRaw !== paymentAmountRaw) {
    // Prefer consideration sum (includes fee splits); envelope should match.
    // If they diverge, fail closed — something unexpected in the order.
    throw new Error(
      `seaport-extract: price envelope ${envelopeRaw} != consideration sum ${paymentAmountRaw}`,
    );
  }
  if (paymentAmountRaw === 0n && envelopeRaw !== null) {
    paymentAmountRaw = envelopeRaw;
  }
  if (paymentAmountRaw <= 0n) {
    throw new Error('seaport-extract: could not derive payment amount');
  }

  return {
    tokenIds,
    collectionContracts,
    seller: asAddress(params.offerer),
    paymentAmountRaw,
    paymentTokenAddress,
    paymentIsNative,
    orderExpiry: parseEpoch(params.endTime),
    orderHash: typeof order.order_hash === 'string' ? order.order_hash : null,
    protocolAddress: asAddress(order.protocol_address),
  };
}

/**
 * Best-effort: confirm the fulfiller/buyer address appears in calldata.
 * Seaport encodes the recipient/fulfiller as a 32-byte word; we require
 * the 20-byte address (lowercase, no 0x) to appear in the hex data.
 */
export function calldataMentionsAddress(data: string | undefined, address: string): boolean {
  if (!data || !/^0x[a-fA-F0-9]*$/.test(data)) return false;
  const needle = address.toLowerCase().replace(/^0x/, '');
  if (needle.length !== 40) return false;
  return data.toLowerCase().includes(needle);
}
