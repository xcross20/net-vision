/**
 * Pure cart reducer. The provider dispatches these actions and persists
 * the resulting state to localStorage.
 */
import type { CartAction, CartItem, CartState } from './types';
import { CART_MAX_ITEMS } from './types';
import { cartAssetId } from './identity';

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: dedupe(action.items), hydrated: true, revision: 0 };
    case 'ADD': {
      if (state.items.some((existing) => cartAssetId(existing) === cartAssetId(action.item))) {
        return state;
      }
      const next = [...state.items, action.item];
      return { ...state, items: dedupe(next), revision: state.revision + 1 };
    }
    case 'UPSERT': {
      const id = cartAssetId(action.item);
      const without = state.items.filter((existing) => cartAssetId(existing) !== id);
      if (without.length >= CART_MAX_ITEMS && without.length === state.items.length) {
        return state;
      }
      return { ...state, items: dedupe([...without, action.item]), revision: state.revision + 1 };
    }
    case 'REMOVE': {
      const next = state.items.filter((it) => {
        if (action.contractAddress) {
          return cartAssetId(it) !== cartAssetId({ contractAddress: action.contractAddress, tokenId: action.tokenId });
        }
        return it.tokenId !== action.tokenId;
      });
      if (next.length === state.items.length) return state;
      return { ...state, items: next, revision: state.revision + 1 };
    }
    case 'CLEAR':
      if (state.items.length === 0) return state;
      return { ...state, items: [], revision: state.revision + 1 };
    case 'REMOVE_CONFIRMED': {
      const removeSet = new Set(action.tokenIds);
      const next = state.items.filter((it) => !removeSet.has(it.tokenId));
      if (next.length === state.items.length) return state;
      return { ...state, items: next, revision: state.revision + 1 };
    }
    default:
      return state;
  }
}

function dedupe(items: CartItem[]): CartItem[] {
  const seen = new Set<string>();
  const out: CartItem[] = [];
  for (const item of items) {
    const id = cartAssetId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export const initialCartState: CartState = { items: [], hydrated: false, revision: 0 };
