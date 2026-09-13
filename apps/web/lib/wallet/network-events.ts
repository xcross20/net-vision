/**
 * Sanitized network-gate observability. No calldata, no secrets.
 */
export type NetworkGateEventName =
  | 'wrong_network_detected'
  | 'network_switch_requested'
  | 'network_switch_rejected'
  | 'network_switch_succeeded'
  | 'network_add_requested'
  | 'network_add_rejected'
  | 'network_add_succeeded'
  | 'network_verification_failed';

export type NetworkGateEvent = {
  name: NetworkGateEventName;
  at: number;
  fromChainId: number | null;
  targetChainId: number;
  connectorType: string | null;
  checkoutState: string | null;
};

const listeners = new Set<(event: NetworkGateEvent) => void>();

export function subscribeNetworkGateEvents(listener: (event: NetworkGateEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordNetworkGateEvent(
  name: NetworkGateEventName,
  input?: {
    fromChainId?: number | null;
    targetChainId?: number;
    connectorType?: string | null;
    checkoutState?: string | null;
  },
): NetworkGateEvent {
  const event: NetworkGateEvent = {
    name,
    at: Date.now(),
    fromChainId: input?.fromChainId ?? null,
    targetChainId: input?.targetChainId ?? 4663,
    connectorType: input?.connectorType ?? null,
    checkoutState: input?.checkoutState ?? null,
  };
  for (const listener of listeners) listener(event);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nv:network-gate', { detail: event }));
  }
  return event;
}
