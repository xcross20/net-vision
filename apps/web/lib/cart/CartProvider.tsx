/**
 * Cart provider. Holds the cart in React state, hydrates from
 * localStorage on mount, and writes back on every change. The
 * provider is client-only and intentionally minimal so it can be
 * composed inside the existing WalletProvider tree.
 */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cartReducer, initialCartState } from './reducer';
import {
  clearCartInStorage,
  loadCartFromStorage,
  saveCartToStorage,
} from './storage';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import type {
  CartItem,
  CartItemDraft,
  CartPhase,
  CheckoutItem,
} from './types';
import { CART_MAX_ITEMS } from './types';

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  itemCount: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (draft: CartItemDraft) => { ok: boolean; reason?: string };
  addMany: (drafts: CartItemDraft[]) => { added: string[]; skipped: Array<{ tokenId: string; reason: string }> };
  remove: (tokenId: string) => void;
  clear: () => void;
  removeConfirmed: (tokenIds: ReadonlyArray<string>) => void;
  phase: CartPhase;
  setPhase: (phase: CartPhase) => void;
  requestReview: () => void;
  consumeReviewRequest: () => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<CartPhase>({ kind: 'browsing' });
  const reviewRequestedRef = useRef(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const items = loadCartFromStorage();
    dispatch({ type: 'HYDRATE', items });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    saveCartToStorage(state.items);
  }, [state.items, state.hydrated]);

  const add = useCallback(
    (draft: CartItemDraft): { ok: boolean; reason?: string } => {
      const built = buildCartItem(draft);
      if ('reason' in built) return { ok: false, reason: built.reason };
      if (state.items.some((existing) => existing.tokenId === built.item.tokenId)) {
        return { ok: false, reason: 'already-in-cart' };
      }
      if (state.items.length >= CART_MAX_ITEMS) {
        return { ok: false, reason: 'cart-full' };
      }
      dispatch({ type: 'ADD', item: built.item });
      return { ok: true };
    },
    [state.items],
  );

  const addMany = useCallback(
    (drafts: CartItemDraft[]) => {
      const added: string[] = [];
      const skipped: Array<{ tokenId: string; reason: string }> = [];
      let current = [...state.items];
      for (const draft of drafts) {
        const built = buildCartItem(draft);
        if ('reason' in built) {
          skipped.push({ tokenId: draft.token.tokenId, reason: built.reason });
          continue;
        }
        if (current.some((existing) => existing.tokenId === built.item.tokenId)) {
          skipped.push({ tokenId: built.item.tokenId, reason: 'already-in-cart' });
          continue;
        }
        if (current.length >= CART_MAX_ITEMS) {
          skipped.push({ tokenId: built.item.tokenId, reason: 'cart-full' });
          continue;
        }
        dispatch({ type: 'ADD', item: built.item });
        current = [...current, built.item];
        added.push(built.item.tokenId);
      }
      return { added, skipped };
    },
    [state.items],
  );

  const remove = useCallback((tokenId: string) => {
    dispatch({ type: 'REMOVE', tokenId });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    clearCartInStorage();
  }, []);

  const removeConfirmed = useCallback((tokenIds: ReadonlyArray<string>) => {
    dispatch({ type: 'REMOVE_CONFIRMED', tokenIds });
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const requestReview = useCallback(() => {
    reviewRequestedRef.current = true;
  }, []);
  const consumeReviewRequest = useCallback(() => {
    if (!reviewRequestedRef.current) return false;
    reviewRequestedRef.current = false;
    return true;
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      hydrated: state.hydrated,
      itemCount: state.items.length,
      isOpen,
      open,
      close,
      add,
      addMany,
      remove,
      clear,
      removeConfirmed,
      phase,
      setPhase,
      requestReview,
      consumeReviewRequest,
    }),
    [
      state.items,
      state.hydrated,
      isOpen,
      open,
      close,
      add,
      addMany,
      remove,
      clear,
      removeConfirmed,
      phase,
      requestReview,
      consumeReviewRequest,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function buildCartItem(
  draft: CartItemDraft,
): { item: CartItem } | { reason: string } {
  const tokenId = draft.token.tokenId;
  const contract =
    draft.contractAddressOverride ??
    (draft.token.contractAddress as `0x${string}`);
  if (
    contract.toLowerCase() !==
    BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase()
  ) {
    return { reason: 'wrong-collection' };
  }
  const categories = draft.token.traits
    .filter((t) => t.family !== 'digits' && t.family !== 'number')
    .slice(0, 4)
    .map((t) => ({ slug: t.slug, label: t.label }));
  return {
    item: {
      collectionSlug: 'button-presser',
      contractAddress: contract.toLowerCase() as `0x${string}`,
      tokenId,
      imageUrl: draft.token.imageUrl,
      displayName: draft.token.name ?? `#${tokenId}`,
      categories,
      sourceMarketplace: draft.sourceMarketplace ?? 'opensea',
      displayedOrderHash: draft.displayedOrderHash ?? draft.token.listingOrderHash ?? null,
      displayedPriceRaw: draft.displayedPriceRaw ?? draft.token.listingPriceRaw ?? null,
      displayedPriceDecimal: draft.displayedPriceDecimal ?? null,
      currencySymbol:
        draft.currencySymbol ??
        (draft.token.currency && draft.token.currency !== 'ETH'
          ? draft.token.currency
          : null),
      currencyAddress: (draft.currencyAddress ?? null) as `0x${string}` | null,
      currencyDecimals: draft.currencyDecimals ?? null,
      addedAt: Date.now(),
    },
  };
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return ctx;
}

export type { CartItem, CartItemDraft, CartPhase, CheckoutItem };
