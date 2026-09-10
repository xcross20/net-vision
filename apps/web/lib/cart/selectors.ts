/**
 * Single source of truth for checkout totals. Every amount in the cart
 * footer must derive from live cart membership ∩ checkout validation.
 */
import type { CartItem, CartPhase, CheckoutItem } from './types';
import { cartAssetId, cartMembershipSet } from './identity';

export type ValidCheckoutItem = Extract<CheckoutItem, { state: 'valid' }>;

export function checkoutItemsFromPhase(phase: CartPhase): CheckoutItem[] {
  if (
    phase.kind === 'review' ||
    phase.kind === 'payment_select' ||
    phase.kind === 'executing'
  ) {
    return phase.items;
  }
  if (phase.kind === 'recovery') {
    return [...phase.confirmed, ...phase.failed];
  }
  return [];
}

export function currentCheckoutItems(
  phase: CartPhase,
  cartItems: ReadonlyArray<CartItem>,
): CheckoutItem[] {
  const live = cartMembershipSet(cartItems);
  return checkoutItemsFromPhase(phase).filter((row) => live.has(cartAssetId(row.cartItem)));
}

export function validCheckoutItems(
  phase: CartPhase,
  cartItems: ReadonlyArray<CartItem>,
): ValidCheckoutItem[] {
  return currentCheckoutItems(phase, cartItems).filter(
    (row): row is ValidCheckoutItem => row.state === 'valid',
  );
}

export function originalTotalDecimal(
  phase: CartPhase,
  cartItems: ReadonlyArray<CartItem>,
): number {
  return validCheckoutItems(phase, cartItems).reduce((sum, it) => {
    const snap = Number(it.cartItem.displayedPriceDecimal ?? it.livePriceDecimal);
    return sum + (Number.isFinite(snap) ? snap : it.livePriceDecimal);
  }, 0);
}

export function currentTotalDecimal(
  phase: CartPhase,
  cartItems: ReadonlyArray<CartItem>,
): number {
  return validCheckoutItems(phase, cartItems).reduce((sum, it) => sum + it.livePriceDecimal, 0);
}

export function requiredUsdgRaw(
  phase: CartPhase,
  cartItems: ReadonlyArray<CartItem>,
): bigint {
  return validCheckoutItems(phase, cartItems).reduce(
    (sum, it) => sum + BigInt(String(it.livePriceRaw)),
    0n,
  );
}

export function checkoutCurrency(
  phase: CartPhase,
  cartItems: ReadonlyArray<CartItem>,
): string {
  return validCheckoutItems(phase, cartItems)[0]?.liveCurrency ?? 'USDG';
}
