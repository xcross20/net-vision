import type { CheckoutPhase } from './types';

const ALLOWED: Record<CheckoutPhase, CheckoutPhase[]> = {
  quoted: ['swap_pending', 'usdg_confirmed', 'failed'],
  swap_pending: ['usdg_confirmed', 'failed', 'recovery'],
  usdg_confirmed: ['listing_revalidated', 'recovery', 'failed'],
  listing_revalidated: ['purchase_pending', 'recovery', 'failed'],
  purchase_pending: ['confirmed', 'recovery', 'failed'],
  confirmed: [],
  failed: ['recovery'],
  recovery: ['failed', 'quoted'],
};

export function initialPhaseAfterQuote(inputAssetId: string): CheckoutPhase {
  return inputAssetId === 'usdg' ? 'usdg_confirmed' : 'quoted';
}

export function canTransition(from: CheckoutPhase, to: CheckoutPhase): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function transition(from: CheckoutPhase, to: CheckoutPhase): CheckoutPhase {
  if (!canTransition(from, to)) {
    throw new Error(`illegal checkout transition ${from} -> ${to}`);
  }
  return to;
}

/** Conversion succeeded, listing gone: user keeps USDG. Never auto-swap back. Never auto-buy another NFT. */
export const LISTING_GONE_AFTER_SWAP = 'recovery' as const;
