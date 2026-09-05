/**
 * Cart domain types.
 *
 * The cart is local intent only. Listings are revalidated from OpenSea
 * before any executable transaction reaches the wallet, so stored price
 * and order hash are treated as snapshots, not authority.
 */
import type { Token } from '@/lib/market';

export const CART_STORAGE_KEY = 'net-vision:cart:v1';
export const CART_MAX_ITEMS = 20;

export type CartItemSourceMarketplace = 'opensea' | 'net_vision';

export type CartItem = {
  collectionSlug: 'button-presser';
  contractAddress: `0x${string}`;
  tokenId: string;
  imageUrl: string;
  displayName: string;
  categories: Array<{ slug: string; label: string }>;
  sourceMarketplace: CartItemSourceMarketplace;
  /** Snapshot of the order hash the user saw when adding the item. */
  displayedOrderHash: string | null;
  /** Raw price string from OpenSea at add time. */
  displayedPriceRaw: string | null;
  /** Human-readable decimal price at add time, e.g. "18.40". */
  displayedPriceDecimal: string | null;
  currencySymbol: string | null;
  currencyAddress: `0x${string}` | null;
  currencyDecimals: number | null;
  addedAt: number;
};

export type CartItemDraft = {
  token: Token;
  collectionSlug?: 'button-presser';
  contractAddressOverride?: string;
  displayedOrderHash?: string | null;
  displayedPriceRaw?: string | null;
  displayedPriceDecimal?: string | null;
  currencySymbol?: string | null;
  currencyAddress?: string | null;
  currencyDecimals?: number | null;
  sourceMarketplace?: CartItemSourceMarketplace;
};

export type CartAction =
  | { type: 'ADD'; item: CartItem }
  | { type: 'REMOVE'; tokenId: string }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; items: CartItem[] }
  | { type: 'REMOVE_CONFIRMED'; tokenIds: ReadonlyArray<string> };

export type CartState = {
  items: CartItem[];
  hydrated: boolean;
};

export type CheckoutItem =
  | {
      tokenId: string;
      state: 'valid';
      cartItem: CartItem;
      liveOrderHash: string;
      livePriceRaw: bigint;
      livePriceDecimal: number;
      livePriceDisplay: string;
      liveCurrency: string;
      liveProtocolAddress: string;
      liveValidUntil: number | null;
      priceChanged: boolean;
    }
  | {
      tokenId: string;
      state: 'unavailable';
      cartItem: CartItem;
      reason: 'sold' | 'expired' | 'no_listing' | 'unsupported_order';
    }
  | {
      tokenId: string;
      state: 'error';
      cartItem: CartItem;
      message: string;
    };

export type CartPhase =
  | { kind: 'browsing' }
  | { kind: 'revalidating' }
  | { kind: 'review'; items: CheckoutItem[] }
  | { kind: 'executing'; items: CheckoutItem[]; currentIndex: number; confirmedTokenIds: string[] }
  | { kind: 'complete'; confirmed: CheckoutItem[]; failed: CheckoutItem[] }
  | { kind: 'error'; message: string };
