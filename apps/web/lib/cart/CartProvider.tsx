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
  remove: (tokenId: string) => void;
  clear: () => void;
  removeConfirmed: (tokenIds: ReadonlyArray<string>) => void;
  phase: CartPhase;
  setPhase: (phase: CartPhase) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<CartPhase>({ kind: 'browsing' });
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
      const tokenId = draft.token.tokenId;
      if (state.items.some((existing) => existing.tokenId === tokenId)) {
        return { ok: false, reason: 'already-in-cart' };
      }
      if (state.items.length >= CART_MAX_ITEMS) {
        return { ok: false, reason: 'cart-full' };
      }
      const contract =
        draft.contractAddressOverride ??
        (draft.token.contractAddress as `0x${string}`);
      if (
        contract.toLowerCase() !==
        BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase()
      ) {
        return { ok: false, reason: 'wrong-collection' };
      }
      const categories = draft.token.traits
        .filter((t) => t.family !== 'digits')
        .slice(0, 4)
        .map((t) => ({ slug: t.slug, label: t.label }));
      const item: CartItem = {
        collectionSlug: 'button-presser',
        contractAddress: contract.toLowerCase() as `0x${string}`,
        tokenId,
        imageUrl: draft.token.imageUrl,
        displayName: draft.token.name ?? `#${tokenId}`,
        categories,
        sourceMarketplace: draft.sourceMarketplace ?? 'opensea',
        displayedOrderHash: draft.displayedOrderHash ?? null,
        displayedPriceRaw: draft.displayedPriceRaw ?? null,
        displayedPriceDecimal: draft.displayedPriceDecimal ?? null,
        currencySymbol:
          draft.currencySymbol ??
          (draft.token.currency && draft.token.currency !== 'ETH'
            ? draft.token.currency
            : null),
        currencyAddress: (draft.currencyAddress ?? null) as `0x${string}` | null,
        currencyDecimals: draft.currencyDecimals ?? null,
        addedAt: Date.now(),
      };
      dispatch({ type: 'ADD', item });
      return { ok: true };
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

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      hydrated: state.hydrated,
      itemCount: state.items.length,
      isOpen,
      open,
      close,
      add,
      remove,
      clear,
      removeConfirmed,
      phase,
      setPhase,
    }),
    [state.items, state.hydrated, isOpen, open, close, add, remove, clear, removeConfirmed, phase],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return ctx;
}

export type { CartItem, CartItemDraft, CartPhase, CheckoutItem };
