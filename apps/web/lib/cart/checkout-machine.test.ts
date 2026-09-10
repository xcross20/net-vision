import { describe, expect, it } from 'vitest';
import {
  assertCanMarkConfirmed,
  assertCanPreparePurchase,
  assertCanSelectPaymentAsset,
  assertPartialCartNotFullyConfirmed,
  assertRecoveryKeepsUsdg,
  assertRoutedAssetMustSwap,
  assertStaleSnapshotBlocked,
  assertTransition,
  assertUsdgSkipsSwap,
  canTransition,
  isExecutablePaymentAsset,
} from './checkout-machine';

describe('checkout state machine', () => {
  it('allows USDG allowance then final revalidation', () => {
    expect(canTransition('PAYMENT_READY', 'USDG_ALLOWANCE_REQUIRED')).toBe(true);
    expect(canTransition('APPROVAL_CONFIRMED', 'LISTING_REVALIDATING_FINAL')).toBe(true);
  });

  it('auto-advances wallet and network recognition into revalidation', () => {
    expect(canTransition('BROWSING', 'WALLET_REQUIRED')).toBe(true);
    expect(canTransition('WALLET_REQUIRED', 'NETWORK_REQUIRED')).toBe(true);
    expect(canTransition('NETWORK_REQUIRED', 'REVALIDATING')).toBe(true);
    expect(canTransition('WALLET_REQUIRED', 'REVALIDATING')).toBe(true);
  });

  it('allows the USDG happy path', () => {
    const path = [
      'BROWSING',
      'REVALIDATING',
      'REVIEW',
      'PAYMENT_SELECT',
      'PAYMENT_READY',
      'LISTING_REVALIDATING_FINAL',
      'PURCHASE_PREPARING',
      'PURCHASE_SIGNING',
      'PURCHASE_PENDING',
      'CONFIRMED',
    ] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('rejects skipping revalidation', () => {
    expect(canTransition('BROWSING', 'PURCHASE_PREPARING')).toBe(false);
    expect(() => assertTransition('BROWSING', 'CONFIRMED')).toThrow(/illegal checkout transition/);
  });

  it('cannot prepare purchase without accepted live order hash', () => {
    expect(() =>
      assertCanPreparePurchase({
        acceptedOrderHash: null,
        acceptedPriceRaw: '1850000',
        listingState: 'valid',
      }),
    ).toThrow(/accepted live order hash/);
  });

  it('cannot prepare purchase without accepted live price', () => {
    expect(() =>
      assertCanPreparePurchase({
        acceptedOrderHash: '0xabc',
        acceptedPriceRaw: null,
        listingState: 'valid',
      }),
    ).toThrow(/accepted live price/);
  });

  it('cannot prepare purchase from an unavailable listing', () => {
    expect(() =>
      assertCanPreparePurchase({
        acceptedOrderHash: '0xabc',
        acceptedPriceRaw: '1850000',
        listingState: 'unavailable',
      }),
    ).toThrow(/live valid listing/);
  });

  it('cannot display CONFIRMED before receipt success', () => {
    expect(() => assertCanMarkConfirmed(null)).toThrow(/receipt success/);
    expect(() => assertCanMarkConfirmed('pending')).toThrow(/receipt success/);
    expect(() => assertCanMarkConfirmed('reverted')).toThrow(/receipt success/);
    expect(() => assertCanMarkConfirmed('success')).not.toThrow();
  });

  it('cannot execute a stale cart snapshot without revalidation', () => {
    expect(() =>
      assertStaleSnapshotBlocked({
        revalidated: false,
        snapshotOrderHash: '0xold',
        liveOrderHash: '0xold',
      }),
    ).toThrow(/without revalidation/);
  });

  it('only USDG is executable until routed assets pass independently', () => {
    expect(isExecutablePaymentAsset('USDG')).toBe(true);
    expect(isExecutablePaymentAsset('ETH')).toBe(false);
    expect(isExecutablePaymentAsset('NET')).toBe(false);
    expect(isExecutablePaymentAsset('NVDA')).toBe(false);
    expect(() => assertCanSelectPaymentAsset('ETH')).toThrow(/not verified/);
    expect(() => assertCanSelectPaymentAsset('USDG')).not.toThrow();
  });

  it('USDG must skip swap; routed assets must not skip USDG confirmation', () => {
    expect(() => assertUsdgSkipsSwap('USDG', 'SWAP_SIGNING')).toThrow(/must not enter a swap/);
    expect(() => assertUsdgSkipsSwap('USDG', 'LISTING_REVALIDATING_FINAL')).not.toThrow();
    expect(() => assertRoutedAssetMustSwap('ETH', 'LISTING_REVALIDATING_FINAL')).toThrow(
      /must confirm USDG/,
    );
  });

  it('partial multi-item success is not full-cart CONFIRMED', () => {
    expect(() =>
      assertPartialCartNotFullyConfirmed({
        confirmedCount: 1,
        failedCount: 1,
        kind: 'CONFIRMED',
      }),
    ).toThrow(/partial multi-item/);
  });

  it('swap success + listing gone is RECOVERY, never CONFIRMED', () => {
    expect(() =>
      assertRecoveryKeepsUsdg({
        swapConfirmed: true,
        listingAvailable: false,
        kind: 'CONFIRMED',
      }),
    ).toThrow(/RECOVERY/);
    expect(() =>
      assertRecoveryKeepsUsdg({
        swapConfirmed: true,
        listingAvailable: false,
        kind: 'RECOVERY',
      }),
    ).not.toThrow();
  });
});
