/**
 * Sanitized checkout reactivity events. No calldata, no secrets.
 */
export type CheckoutReactivityEventName =
  | 'checkout_blocker_entered'
  | 'checkout_blocker_resolved'
  | 'cart_revision_changed'
  | 'checkout_snapshot_reconciled'
  | 'wallet_connected_checkout_resumed'
  | 'network_corrected_checkout_resumed'
  | 'balance_sufficient_checkout_resumed'
  | 'allowance_sufficient_checkout_resumed';

export type CheckoutReactivityEvent = {
  name: CheckoutReactivityEventName;
  at: number;
  cartRevision: number | null;
  checkoutState: string | null;
  droppedCount: number | null;
};

const listeners = new Set<(event: CheckoutReactivityEvent) => void>();

export function subscribeCheckoutEvents(
  listener: (event: CheckoutReactivityEvent) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordCheckoutEvent(
  name: CheckoutReactivityEventName,
  input?: {
    cartRevision?: number | null;
    checkoutState?: string | null;
    droppedCount?: number | null;
  },
): CheckoutReactivityEvent {
  const event: CheckoutReactivityEvent = {
    name,
    at: Date.now(),
    cartRevision: input?.cartRevision ?? null,
    checkoutState: input?.checkoutState ?? null,
    droppedCount: input?.droppedCount ?? null,
  };
  for (const listener of listeners) listener(event);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nv:checkout', { detail: event }));
  }
  return event;
}
