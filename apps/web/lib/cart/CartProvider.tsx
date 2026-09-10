/**
 * Cart provider. Holds the cart in React state, hydrates from
 * localStorage on mount, and writes back on every change. The
 * provider is client-only and intentionally minimal so it can be
 * composed inside the existing WalletProvider tree.
 *
 * CartProvider.items is the only live membership authority.
 * Checkout phases may hold validated facts, never extra membership.
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
import { cartAssetId } from './identity';
import { canRemoveCartAsset, phasesEqualForReconcile, reconcileCheckoutWithCart } from './reconcile';
import { recordCheckoutEvent } from './checkout-events';

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  itemCount: number;
  cartRevision: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (draft: CartItemDraft) => { ok: boolean; reason?: string };
  /** Add or replace one item, open the cart, and start checkout review. */
  buyNow: (draft: CartItemDraft) => { ok: boolean; reason?: string };
  addMany: (drafts: CartItemDraft[]) => { added: string[]; skipped: Array<{ tokenId: string; reason: string }> };
  remove: (tokenId: string, contractAddress?: string) => { ok: boolean; reason?: string };
  clear: () => void;
  removeConfirmed: (tokenIds: ReadonlyArray<string>) => void;
  phase: CartPhase;
  setPhase: (phase: CartPhase) => void;
  checkoutIntent: boolean;
  setCheckoutIntent: (value: boolean) => void;
  requestReview: () => void;
  consumeReviewRequest: () => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhaseState] = useState<CartPhase>({ kind: 'browsing' });
  const [checkoutIntent, setCheckoutIntentState] = useState(false);
  const reviewRequestedRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastRevisionRef = useRef(0);
  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;

  const setPhase = useCallback((next: CartPhase) => {
    setPhaseState(() => reconcileCheckoutWithCart({ phase: next, cartItems: itemsRef.current }).phase);
  }, []);

  const setCheckoutIntent = useCallback((value: boolean) => {
    setCheckoutIntentState(value);
  }, []);

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

  useEffect(() => {
    setPhaseState((prev) => {
      const result = reconcileCheckoutWithCart({ phase: prev, cartItems: state.items });
      if (result.droppedAssetIds.length > 0) {
        recordCheckoutEvent('checkout_snapshot_reconciled', {
          cartRevision: state.revision,
          checkoutState: prev.kind,
          droppedCount: result.droppedAssetIds.length,
        });
      }
      if (phasesEqualForReconcile(prev, result.phase)) return prev;
      return result.phase;
    });
    if (state.items.length === 0 && checkoutIntent) {
      setCheckoutIntentState(false);
    }
  }, [state.items, state.revision, checkoutIntent]);

  useEffect(() => {
    if (lastRevisionRef.current === state.revision) return;
    if (state.revision > 0) {
      recordCheckoutEvent('cart_revision_changed', { cartRevision: state.revision, checkoutState: phase.kind });
    }
    lastRevisionRef.current = state.revision;
  }, [phase.kind, state.revision]);

  const add = useCallback(
    (draft: CartItemDraft): { ok: boolean; reason?: string } => {
      const built = buildCartItem(draft);
      if ('reason' in built) return { ok: false, reason: built.reason };
      if (state.items.some((existing) => cartAssetId(existing) === cartAssetId(built.item))) {
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

  const buyNow = useCallback(
    (draft: CartItemDraft): { ok: boolean; reason?: string } => {
      const built = buildCartItem(draft);
      if ('reason' in built) return { ok: false, reason: built.reason };
      const exists = state.items.some((existing) => cartAssetId(existing) === cartAssetId(built.item));
      if (!exists && state.items.length >= CART_MAX_ITEMS) {
        return { ok: false, reason: 'cart-full' };
      }
      dispatch({ type: 'UPSERT', item: built.item });
      reviewRequestedRef.current = true;
      setCheckoutIntentState(true);
      setIsOpen(true);
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
        if (current.some((existing) => cartAssetId(existing) === cartAssetId(built.item))) {
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

  const remove = useCallback((tokenId: string, contractAddress?: string) => {
    const item = state.items.find((row) =>
      contractAddress
        ? cartAssetId(row) === cartAssetId({ contractAddress, tokenId })
        : row.tokenId === tokenId,
    );
    if (item) {
      const allowed = canRemoveCartAsset(phase, item);
      if (!allowed.ok) return { ok: false, reason: allowed.reason };
    }
    dispatch({ type: 'REMOVE', tokenId, contractAddress });
    return { ok: true };
  }, [phase, state.items]);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    clearCartInStorage();
    setCheckoutIntentState(false);
  }, []);

  const removeConfirmed = useCallback((tokenIds: ReadonlyArray<string>) => {
    dispatch({ type: 'REMOVE_CONFIRMED', tokenIds });
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    if (phase.kind === 'browsing' || phase.kind === 'wallet_required' || phase.kind === 'network_required') {
      setCheckoutIntentState(false);
    }
  }, [phase.kind]);
  const requestReview = useCallback(() => {
    reviewRequestedRef.current = true;
    setCheckoutIntentState(true);
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
      cartRevision: state.revision,
      isOpen,
      open,
      close,
      add,
      buyNow,
      addMany,
      remove,
      clear,
      removeConfirmed,
      phase,
      setPhase,
      checkoutIntent,
      setCheckoutIntent,
      requestReview,
      consumeReviewRequest,
    }),
    [
      state.items,
      state.hydrated,
      state.revision,
      isOpen,
      open,
      close,
      add,
      buyNow,
      addMany,
      remove,
      clear,
      removeConfirmed,
      phase,
      setPhase,
      checkoutIntent,
      setCheckoutIntent,
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
