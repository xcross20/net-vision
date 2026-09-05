/**
 * Pure cart reducer. The provider dispatches these actions and persists
 * the resulting state to localStorage.
 */
import type { CartAction, CartItem, CartState } from './types';

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return { items: dedupe(action.items), hydrated: true };
    case 'ADD': {
      if (state.items.some((existing) => existing.tokenId === action.item.tokenId)) {
        return state;
      }
      const next = [...state.items, action.item];
      return { ...state, items: dedupe(next) };
    }
    case 'REMOVE':
      return {
        ...state,
        items: state.items.filter((it) => it.tokenId !== action.tokenId),
      };
    case 'CLEAR':
      return { ...state, items: [] };
    case 'REMOVE_CONFIRMED': {
      const removeSet = new Set(action.tokenIds);
      return {
        ...state,
        items: state.items.filter((it) => !removeSet.has(it.tokenId)),
      };
    }
    default:
      return state;
  }
}

function dedupe(items: CartItem[]): CartItem[] {
  const seen = new Set<string>();
  const out: CartItem[] = [];
  for (const item of items) {
    if (seen.has(item.tokenId)) continue;
    seen.add(item.tokenId);
    out.push(item);
  }
  return out;
}

export const initialCartState: CartState = { items: [], hydrated: false };
