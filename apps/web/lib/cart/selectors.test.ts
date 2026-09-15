import { describe, expect, it } from 'vitest';
import { deriveCheckoutCta } from '@/lib/payment/checkout-cta';
import type { CartItem, CartPhase, CheckoutItem } from './types';
import { checkoutCtaItemCount, validCheckoutItems } from './selectors';

const CONTRACT = '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2';

function cartItem(tokenId: string): CartItem {
  return {
    collectionSlug: 'button-presser',
    contractAddress: CONTRACT,
    tokenId,
    imageUrl: '/x',
    displayName: `#${tokenId}`,
    categories: [],
    sourceMarketplace: 'opensea',
    displayedOrderHash: `0x${tokenId}`,
    displayedPriceRaw: '33900000',
    displayedPriceDecimal: '33.9',
    currencySymbol: 'USDG',
    currencyAddress: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
    currencyDecimals: 6,
    addedAt: 1,
  };
}

function validRow(tokenId: string): CheckoutItem {
  const item = cartItem(tokenId);
  return {
    tokenId,
    state: 'valid',
    cartItem: item,
    liveOrderHash: `0x${tokenId}`,
    livePriceRaw: 33900000n,
    livePriceDecimal: 33.9,
    livePriceDisplay: '33.9',
    liveCurrency: 'USDG',
    liveProtocolAddress: '0x0000000000000068F116a894984e2DB1123eB395',
    liveValidUntil: null,
    priceChanged: false,
  };
}

describe('checkoutCtaItemCount', () => {
  const items = [cartItem('4508'), cartItem('2975')];

  it('browsing counts visible cart lines, not revalidated listings', () => {
    const phase: CartPhase = { kind: 'browsing' };
    expect(validCheckoutItems(phase, items)).toEqual([]);
    expect(checkoutCtaItemCount(phase, items)).toBe(2);
  });

  it('wallet and network gates still count visible cart lines', () => {
    expect(checkoutCtaItemCount({ kind: 'wallet_required' }, items)).toBe(2);
    expect(checkoutCtaItemCount({ kind: 'network_required' }, items)).toBe(2);
  });

  it('does not tell a populated browsing cart that it is empty', () => {
    const count = checkoutCtaItemCount({ kind: 'browsing' }, items);
    const cta = deriveCheckoutCta({
      selected: null,
      isConnected: true,
      onRobinhood: true,
      cartItemCount: count,
      canBuy: false,
    });
    expect(cta.label).toBe('Review 2 items');
    expect(cta.kind).toBe('review_required');
  });

  it('empty browsing cart is the only Cart is empty path', () => {
    const count = checkoutCtaItemCount({ kind: 'browsing' }, []);
    const cta = deriveCheckoutCta({
      selected: null,
      isConnected: true,
      onRobinhood: true,
      cartItemCount: count,
      canBuy: false,
    });
    expect(cta.label).toBe('Cart is empty');
  });

  it('payment_select counts only still-valid listings', () => {
    const phase: CartPhase = {
      kind: 'payment_select',
      items: [validRow('4508')],
      payment: { assetId: 'USDG' },
    };
    expect(checkoutCtaItemCount(phase, items)).toBe(1);
  });
});
