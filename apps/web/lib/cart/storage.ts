/**
 * localStorage adapter for the cart. Validates on read, serializes on
 * write. Failures degrade to an empty cart so a corrupted entry never
 * blocks the UI.
 */
import { CART_STORAGE_KEY } from './types';
import { parseCartFromStorage, serializeCartForStorage } from './schema';
import type { CartItem } from './types';

export function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    return parseCartFromStorage(raw);
  } catch {
    return [];
  }
}

export function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCartForStorage(items));
  } catch {
    // ignore quota / private mode failures
  }
}

export function clearCartInStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
}
