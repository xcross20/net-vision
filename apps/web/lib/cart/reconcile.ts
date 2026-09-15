/**
 * Checkout snapshots may hold validated market facts. They may never
 * preserve membership for tokens no longer in CartProvider.items.
 *
 * Invariant: checkout token set ⊆ current cart token set
 */
import type { CartItem, CartPhase, CheckoutItem } from './types';
import { cartAssetId, cartMembershipSet } from './identity';

export type ReconcileResult = {
  phase: CartPhase;
  droppedAssetIds: string[];
  missingFromSnapshot: string[];
  needRevalidate: boolean;
};

function phaseWithItems(phase: CartPhase, items: CheckoutItem[]): CartPhase {
  if (phase.kind === 'review') return { ...phase, items };
  if (phase.kind === 'payment_select') return { ...phase, items };
  if (phase.kind === 'executing') {
    const valid = items.filter((row) => row.state === 'valid');
    const currentIndex = Math.min(phase.currentIndex, Math.max(valid.length - 1, 0));
    const confirmedTokenIds = phase.confirmedTokenIds.filter((tokenId) =>
      items.some((row) => row.tokenId === tokenId),
    );
    return { ...phase, items, currentIndex, confirmedTokenIds };
  }
  return phase;
}

function recoveryPhase(phase: Extract<CartPhase, { kind: 'recovery' }>, cartItems: ReadonlyArray<CartItem>): CartPhase {
  const live = cartMembershipSet(cartItems);
  const confirmed = phase.confirmed.filter((row) => live.has(cartAssetId(row.cartItem)));
  const failed = phase.failed.filter((row) => live.has(cartAssetId(row.cartItem)));
  if (confirmed.length === 0 && failed.length === 0) return { kind: 'browsing' };
  return { ...phase, confirmed, failed };
}

export function executionLockedAssetId(phase: CartPhase): string | null {
  if (phase.kind !== 'executing') return null;
  const valid = phase.items.filter((row) => row.state === 'valid');
  const current = valid[phase.currentIndex];
  return current ? cartAssetId(current.cartItem) : null;
}

export function canRemoveCartAsset(
  phase: CartPhase,
  asset: { contractAddress: string; tokenId: string },
): { ok: true } | { ok: false; reason: 'execution_locked' } {
  const locked = executionLockedAssetId(phase);
  if (locked && locked === cartAssetId(asset)) {
    return { ok: false, reason: 'execution_locked' };
  }
  return { ok: true };
}

export function reconcileCheckoutWithCart(input: {
  phase: CartPhase;
  cartItems: ReadonlyArray<CartItem>;
}): ReconcileResult {
  const { phase, cartItems } = input;
  if (phase.kind === 'browsing' || phase.kind === 'revalidating' || phase.kind === 'complete') {
    if (cartItems.length === 0 && phase.kind !== 'complete') {
      return { phase: { kind: 'browsing' }, droppedAssetIds: [], missingFromSnapshot: [], needRevalidate: false };
    }
    return { phase, droppedAssetIds: [], missingFromSnapshot: [], needRevalidate: false };
  }
  if (phase.kind === 'error' || phase.kind === 'wallet_required' || phase.kind === 'network_required') {
    if (cartItems.length === 0) {
      return { phase: { kind: 'browsing' }, droppedAssetIds: [], missingFromSnapshot: [], needRevalidate: false };
    }
    return { phase, droppedAssetIds: [], missingFromSnapshot: [], needRevalidate: false };
  }
  if (phase.kind === 'recovery') {
    const next = recoveryPhase(phase, cartItems);
    const before = [...phase.confirmed, ...phase.failed].map((row) => cartAssetId(row.cartItem));
    const after =
      next.kind === 'recovery'
        ? [...next.confirmed, ...next.failed].map((row) => cartAssetId(row.cartItem))
        : [];
    const droppedAssetIds = before.filter((id) => !after.includes(id));
    return {
      phase: next,
      droppedAssetIds,
      missingFromSnapshot: [],
      needRevalidate: false,
    };
  }

  const live = cartMembershipSet(cartItems);
  const locked = executionLockedAssetId(phase);
  const kept: CheckoutItem[] = [];
  const droppedAssetIds: string[] = [];
  for (const row of phase.items) {
    const id = cartAssetId(row.cartItem);
    if (live.has(id) || (locked !== null && id === locked && phase.kind === 'executing')) {
      kept.push(row);
    } else {
      droppedAssetIds.push(id);
    }
  }

  const keptIds = new Set(kept.map((row) => cartAssetId(row.cartItem)));
  const missingFromSnapshot = cartItems
    .map(cartAssetId)
    .filter((id) => !keptIds.has(id) && id !== locked);

  if (kept.length === 0) {
    return {
      phase: { kind: 'browsing' },
      droppedAssetIds,
      missingFromSnapshot,
      needRevalidate: false,
    };
  }

  const next = phaseWithItems(phase, kept);
  return {
    phase: next,
    droppedAssetIds,
    missingFromSnapshot,
    needRevalidate: missingFromSnapshot.length > 0 && phase.kind !== 'executing',
  };
}

export function phasesEqualForReconcile(a: CartPhase, b: CartPhase): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'review' && b.kind === 'review') {
    return checkoutIds(a.items) === checkoutIds(b.items);
  }
  if (a.kind === 'payment_select' && b.kind === 'payment_select') {
    return checkoutIds(a.items) === checkoutIds(b.items) && a.payment.assetId === b.payment.assetId;
  }
  if (a.kind === 'executing' && b.kind === 'executing') {
    return (
      checkoutIds(a.items) === checkoutIds(b.items) &&
      a.currentIndex === b.currentIndex &&
      a.confirmedTokenIds.join(',') === b.confirmedTokenIds.join(',')
    );
  }
  if (a.kind === 'recovery' && b.kind === 'recovery') {
    return checkoutIds(a.confirmed) === checkoutIds(b.confirmed) && checkoutIds(a.failed) === checkoutIds(b.failed);
  }
  return true;
}

function checkoutIds(items: ReadonlyArray<CheckoutItem>): string {
  return items.map((row) => cartAssetId(row.cartItem)).join('|');
}
