import type { CartPhase } from './types';

export type PrimaryCheckoutAction =
  | { kind: 'connect_wallet'; label: 'Connect wallet' }
  | { kind: 'switch_network'; label: 'Switch to Robinhood Chain' }
  | { kind: 'review'; label: string }
  | { kind: 'choose_payment'; label: 'Choose payment' }
  | { kind: 'approve'; label: string }
  | { kind: 'purchase'; label: 'Review purchase' }
  | { kind: 'insufficient_balance'; label: 'Insufficient USDG' }
  | { kind: 'busy'; label: string };

export function primaryCheckoutAction(input: {
  itemCount: number;
  connected: boolean;
  onRobinhood: boolean;
  phase: CartPhase;
  allowanceInsufficient: boolean;
  balanceInsufficient: boolean;
  approveAmountLabel?: string;
}): PrimaryCheckoutAction | null {
  if (input.itemCount === 0) return null;
  if (!input.connected || input.phase.kind === 'wallet_required') {
    return { kind: 'connect_wallet', label: 'Connect wallet' };
  }
  if (!input.onRobinhood || input.phase.kind === 'network_required') {
    return { kind: 'switch_network', label: 'Switch to Robinhood Chain' };
  }
  if (input.phase.kind === 'browsing') {
    return {
      kind: 'review',
      label: `Review ${input.itemCount} item${input.itemCount === 1 ? '' : 's'}`,
    };
  }
  if (input.phase.kind === 'review') {
    return { kind: 'choose_payment', label: 'Choose payment' };
  }
  if (input.phase.kind === 'payment_select') {
    if (input.balanceInsufficient) {
      return { kind: 'insufficient_balance', label: 'Insufficient USDG' };
    }
    if (input.allowanceInsufficient) {
      return {
        kind: 'approve',
        label: input.approveAmountLabel ? `Approve ${input.approveAmountLabel}` : 'Approve USDG (bounded)',
      };
    }
    return { kind: 'purchase', label: 'Review purchase' };
  }
  if (input.phase.kind === 'revalidating' || input.phase.kind === 'executing') {
    return { kind: 'busy', label: input.phase.kind };
  }
  return null;
}
