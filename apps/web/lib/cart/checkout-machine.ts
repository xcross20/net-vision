/**
 * Canonical checkout state machine.
 *
 * One cart. One checkout. One purchase engine. Surfaces (token page,
 * category cards, sweep later) may only enter this machine — they must
 * not call /api/trade/buy/prepare themselves.
 *
 * Non-USDG swap states exist so ETH/NET/stocks can plug in later.
 * Those transitions are rejected until the asset's route is
 * `verified_enabled`. Public TRADING_ENABLED stays off until USDG E2E PASS.
 */
import type { CheckoutItem } from './types';

export type CheckoutKind =
  | 'BROWSING'
  | 'REVALIDATING'
  | 'REVIEW'
  | 'PAYMENT_SELECT'
  | 'PAYMENT_QUOTING'
  | 'PAYMENT_READY'
  | 'USDG_ALLOWANCE_REQUIRED'
  | 'APPROVAL_SIGNING'
  | 'APPROVAL_PENDING'
  | 'APPROVAL_CONFIRMED'
  | 'SWAP_SIGNING'
  | 'SWAP_PENDING'
  | 'USDG_CONFIRMED'
  | 'LISTING_REVALIDATING_FINAL'
  | 'PURCHASE_PREPARING'
  | 'PURCHASE_SIGNING'
  | 'PURCHASE_PENDING'
  | 'CONFIRMED'
  | 'QUOTE_EXPIRED'
  | 'SWAP_FAILED'
  | 'LISTING_CHANGED'
  | 'LISTING_GONE'
  | 'PURCHASE_FAILED'
  | 'USER_REJECTED'
  | 'RECOVERY';

export type PaymentAssetId = 'USDG' | 'ETH' | 'NET' | 'NVDA';

export type PaymentRouteStatus = 'verified_enabled' | 'coming_soon' | 'unavailable';

export type PaymentAsset = {
  id: PaymentAssetId;
  symbol: string;
  label: string;
  routeLabel: string;
  status: PaymentRouteStatus;
  recommended: boolean;
};

export const PAYMENT_ASSETS: readonly PaymentAsset[] = [
  {
    id: 'USDG',
    symbol: 'USDG',
    label: 'USDG',
    routeLabel: 'Direct',
    status: 'verified_enabled',
    recommended: true,
  },
  {
    id: 'ETH',
    symbol: 'ETH',
    label: 'ETH',
    routeLabel: 'ETH → USDG',
    status: 'coming_soon',
    recommended: false,
  },
  {
    id: 'NET',
    symbol: 'NET',
    label: 'NET (NetNet)',
    routeLabel: 'NET → USDG',
    status: 'coming_soon',
    recommended: false,
  },
  {
    id: 'NVDA',
    symbol: 'NVDA',
    label: 'NVDA',
    routeLabel: 'NVDA → USDG',
    status: 'coming_soon',
    recommended: false,
  },
] as const;

const ALLOWED: Record<CheckoutKind, ReadonlyArray<CheckoutKind>> = {
  BROWSING: ['REVALIDATING'],
  REVALIDATING: ['REVIEW', 'LISTING_GONE', 'PURCHASE_FAILED'],
  REVIEW: ['PAYMENT_SELECT', 'BROWSING', 'LISTING_CHANGED', 'LISTING_GONE'],
  PAYMENT_SELECT: ['PAYMENT_QUOTING', 'PAYMENT_READY', 'REVIEW', 'BROWSING'],
  PAYMENT_QUOTING: ['PAYMENT_READY', 'QUOTE_EXPIRED', 'PAYMENT_SELECT'],
  PAYMENT_READY: [
    'USDG_ALLOWANCE_REQUIRED',
    'LISTING_REVALIDATING_FINAL',
    'SWAP_SIGNING',
    'QUOTE_EXPIRED',
    'PAYMENT_SELECT',
  ],
  USDG_ALLOWANCE_REQUIRED: ['APPROVAL_SIGNING', 'PAYMENT_SELECT', 'USER_REJECTED'],
  APPROVAL_SIGNING: ['APPROVAL_PENDING', 'USER_REJECTED'],
  APPROVAL_PENDING: ['APPROVAL_CONFIRMED', 'PURCHASE_FAILED'],
  APPROVAL_CONFIRMED: ['LISTING_REVALIDATING_FINAL'],
  SWAP_SIGNING: ['SWAP_PENDING', 'USER_REJECTED', 'SWAP_FAILED'],
  SWAP_PENDING: ['USDG_CONFIRMED', 'SWAP_FAILED'],
  USDG_CONFIRMED: ['LISTING_REVALIDATING_FINAL', 'RECOVERY'],
  LISTING_REVALIDATING_FINAL: [
    'PURCHASE_PREPARING',
    'LISTING_CHANGED',
    'LISTING_GONE',
    'RECOVERY',
  ],
  PURCHASE_PREPARING: ['PURCHASE_SIGNING', 'PURCHASE_FAILED', 'LISTING_CHANGED'],
  PURCHASE_SIGNING: ['PURCHASE_PENDING', 'USER_REJECTED', 'PURCHASE_FAILED'],
  PURCHASE_PENDING: ['CONFIRMED', 'PURCHASE_FAILED'],
  CONFIRMED: ['BROWSING'],
  QUOTE_EXPIRED: ['PAYMENT_SELECT', 'BROWSING'],
  SWAP_FAILED: ['PAYMENT_SELECT', 'RECOVERY', 'BROWSING'],
  LISTING_CHANGED: ['REVALIDATING', 'REVIEW', 'RECOVERY', 'BROWSING'],
  LISTING_GONE: ['RECOVERY', 'BROWSING'],
  PURCHASE_FAILED: ['PAYMENT_SELECT', 'RECOVERY', 'BROWSING'],
  USER_REJECTED: ['PAYMENT_SELECT', 'BROWSING'],
  RECOVERY: ['BROWSING', 'PAYMENT_SELECT'],
};

export function canTransition(from: CheckoutKind, to: CheckoutKind): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: CheckoutKind, to: CheckoutKind): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal checkout transition ${from} → ${to}`);
  }
}

export function paymentAsset(id: PaymentAssetId): PaymentAsset {
  const row = PAYMENT_ASSETS.find((asset) => asset.id === id);
  if (!row) throw new Error(`unknown payment asset ${id}`);
  return row;
}

export function isExecutablePaymentAsset(id: PaymentAssetId): boolean {
  return paymentAsset(id).status === 'verified_enabled';
}

export function assertCanSelectPaymentAsset(id: PaymentAssetId): void {
  if (!isExecutablePaymentAsset(id)) {
    throw new Error(`payment asset ${id} is not verified+enabled`);
  }
}

export function assertUsdgSkipsSwap(id: PaymentAssetId, next: CheckoutKind): void {
  if (id === 'USDG' && (next === 'SWAP_SIGNING' || next === 'SWAP_PENDING')) {
    throw new Error('USDG checkout must not enter a swap');
  }
}

export function assertRoutedAssetMustSwap(id: PaymentAssetId, next: CheckoutKind): void {
  if (id !== 'USDG' && next === 'LISTING_REVALIDATING_FINAL') {
    throw new Error(`${id} must confirm USDG via swap before final listing revalidation`);
  }
}

export type PrepareGuardInput = {
  acceptedOrderHash: string | null | undefined;
  acceptedPriceRaw: string | null | undefined;
  listingState: CheckoutItem['state'] | 'stale';
};

export function assertCanPreparePurchase(input: PrepareGuardInput): void {
  if (input.listingState !== 'valid') {
    throw new Error('cannot prepare purchase without a live valid listing');
  }
  if (!input.acceptedOrderHash || input.acceptedOrderHash.trim() === '') {
    throw new Error('cannot prepare purchase without accepted live order hash');
  }
  if (!input.acceptedPriceRaw || !/^\d+$/.test(input.acceptedPriceRaw)) {
    throw new Error('cannot prepare purchase without accepted live price');
  }
}

export type ReceiptStatus = 'success' | 'reverted' | 'pending' | null;

export function assertCanMarkConfirmed(receiptStatus: ReceiptStatus): void {
  if (receiptStatus !== 'success') {
    throw new Error('cannot display CONFIRMED before receipt success');
  }
}

export function assertStaleSnapshotBlocked(args: {
  revalidated: boolean;
  snapshotOrderHash: string | null;
  liveOrderHash: string | null;
}): void {
  if (!args.revalidated) {
    throw new Error('cannot execute a stale cart snapshot without revalidation');
  }
  if (!args.liveOrderHash) {
    throw new Error('cannot execute without a live order hash');
  }
  if (args.snapshotOrderHash && args.snapshotOrderHash !== args.liveOrderHash) {
    throw new Error('snapshot order hash drifted; user must accept the live listing');
  }
}

export function assertPartialCartNotFullyConfirmed(args: {
  confirmedCount: number;
  failedCount: number;
  kind: CheckoutKind;
}): void {
  if (args.failedCount > 0 && args.kind === 'CONFIRMED' && args.confirmedCount > 0) {
    throw new Error('partial multi-item success must not report full-cart CONFIRMED');
  }
}

export function assertRecoveryKeepsUsdg(args: {
  swapConfirmed: boolean;
  listingAvailable: boolean;
  kind: CheckoutKind;
}): void {
  if (args.swapConfirmed && !args.listingAvailable && args.kind === 'CONFIRMED') {
    throw new Error('swap succeeded but listing gone: state must be RECOVERY, not CONFIRMED');
  }
}
