import { describe, expect, it } from 'vitest';
import type { CartItem, CartPhase, CheckoutItem } from './types';
import { cartAssetId } from './identity';
import {
  canRemoveCartAsset,
  executionLockedAssetId,
  reconcileCheckoutWithCart,
} from './reconcile';
import {
  currentCheckoutItems,
  currentTotalDecimal,
  originalTotalDecimal,
  requiredUsdgRaw,
  validCheckoutItems,
} from './selectors';
import { checkoutRequestBind, isCheckoutResponseCurrent } from './checkout-request';
import { primaryCheckoutAction } from './primary-action';

const CONTRACT = '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2';

function cartItem(tokenId: string, decimal: string, raw: string): CartItem {
  return {
    collectionSlug: 'button-presser',
    contractAddress: CONTRACT,
    tokenId,
    imageUrl: '/x',
    displayName: `#${tokenId}`,
    categories: [],
    sourceMarketplace: 'opensea',
    displayedOrderHash: `0x${tokenId}`,
    displayedPriceRaw: raw,
    displayedPriceDecimal: decimal,
    currencySymbol: 'USDG',
    currencyAddress: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
    currencyDecimals: 6,
    addedAt: 1,
  };
}

function validRow(tokenId: string, decimal: number, raw: string): CheckoutItem {
  const item = cartItem(tokenId, decimal.toFixed(3), raw);
  return {
    tokenId,
    state: 'valid',
    cartItem: item,
    liveOrderHash: `0x${tokenId}`,
    livePriceRaw: BigInt(raw),
    livePriceDecimal: decimal,
    livePriceDisplay: String(decimal),
    liveCurrency: 'USDG',
    liveProtocolAddress: '0x0000000000000068F116a894984e2DB1123eB395',
    liveValidUntil: null,
    priceChanged: false,
  };
}

describe('screenshot split-brain cart', () => {
  const a = cartItem('20343', '1.360', '1360000');
  const b = cartItem('35088', '1.630', '1630000');
  const review: CartPhase = {
    kind: 'review',
    items: [validRow('20343', 1.36, '1360000'), validRow('35088', 1.63, '1630000')],
  };

  it('review of both items totals 2.990 USDG', () => {
    expect(currentCheckoutItems(review, [a, b])).toHaveLength(2);
    expect(currentTotalDecimal(review, [a, b])).toBeCloseTo(2.99, 5);
    expect(originalTotalDecimal(review, [a, b])).toBeCloseTo(2.99, 5);
    expect(requiredUsdgRaw(review, [a, b])).toBe(2990000n);
  });

  it('removing #35088 drops it from review, totals, and required USDG immediately', () => {
    const { phase, droppedAssetIds } = reconcileCheckoutWithCart({
      phase: review,
      cartItems: [a],
    });
    expect(droppedAssetIds).toEqual([cartAssetId(b)]);
    expect(phase.kind).toBe('review');
    if (phase.kind !== 'review') return;
    expect(phase.items.map((row) => row.tokenId)).toEqual(['20343']);
    expect(currentCheckoutItems(phase, [a])).toHaveLength(1);
    expect(validCheckoutItems(phase, [a])[0]?.tokenId).toBe('20343');
    expect(currentTotalDecimal(phase, [a])).toBeCloseTo(1.36, 5);
    expect(originalTotalDecimal(phase, [a])).toBeCloseTo(1.36, 5);
    expect(requiredUsdgRaw(phase, [a])).toBe(1360000n);
    expect(currentCheckoutItems(phase, [a]).some((row) => row.tokenId === '35088')).toBe(false);
  });

  it('removed token cannot remain in payment_select or execution queue', () => {
    const paying: CartPhase = {
      kind: 'payment_select',
      items: review.items,
      payment: { assetId: 'USDG' },
    };
    const next = reconcileCheckoutWithCart({ phase: paying, cartItems: [a] });
    expect(next.phase.kind).toBe('payment_select');
    if (next.phase.kind !== 'payment_select') return;
    expect(next.phase.items.map((row) => row.tokenId)).toEqual(['20343']);
    expect(requiredUsdgRaw(next.phase, [a])).toBe(1360000n);
  });

  it('empty remaining cart returns to browsing', () => {
    const next = reconcileCheckoutWithCart({ phase: review, cartItems: [] });
    expect(next.phase).toEqual({ kind: 'browsing' });
  });
});

describe('execution lock', () => {
  const a = validRow('20343', 1.36, '1360000');
  const b = validRow('35088', 1.63, '1630000');
  const executing: CartPhase = {
    kind: 'executing',
    items: [a, b],
    currentIndex: 0,
    confirmedTokenIds: [],
  };

  it('locks the in-flight token and allows cancelling later items', () => {
    expect(executionLockedAssetId(executing)).toBe(cartAssetId(a.cartItem));
    expect(canRemoveCartAsset(executing, a.cartItem).ok).toBe(false);
    expect(canRemoveCartAsset(executing, b.cartItem).ok).toBe(true);
    const next = reconcileCheckoutWithCart({
      phase: executing,
      cartItems: [a.cartItem],
    });
    expect(next.phase.kind).toBe('executing');
    if (next.phase.kind !== 'executing') return;
    expect(next.phase.items.map((row) => row.tokenId)).toEqual(['20343']);
    expect(next.droppedAssetIds).toEqual([cartAssetId(b.cartItem)]);
  });

  it('never lets a removed not-started token stay executable', () => {
    const next = reconcileCheckoutWithCart({
      phase: executing,
      cartItems: [a.cartItem],
    });
    const stillQueued = currentCheckoutItems(next.phase, [a.cartItem]);
    expect(stillQueued.some((row) => row.tokenId === '35088')).toBe(false);
  });
});

describe('stale async response guard', () => {
  it('discards a revalidation begun for an older cart revision', () => {
    const started = checkoutRequestBind({ cartRevision: 17, address: '0xabc', chainId: 4663 });
    const live = checkoutRequestBind({ cartRevision: 18, address: '0xabc', chainId: 4663 });
    expect(isCheckoutResponseCurrent(started, live)).toBe(false);
  });

  it('discards when wallet or chain changed', () => {
    const started = checkoutRequestBind({ cartRevision: 1, address: '0xabc', chainId: 369 });
    expect(
      isCheckoutResponseCurrent(
        started,
        checkoutRequestBind({ cartRevision: 1, address: '0xabc', chainId: 4663 }),
      ),
    ).toBe(false);
    expect(
      isCheckoutResponseCurrent(
        started,
        checkoutRequestBind({ cartRevision: 1, address: '0xdef', chainId: 369 }),
      ),
    ).toBe(false);
  });
});

describe('primary checkout CTA', () => {
  it('disconnected cart with items is Connect wallet, not Choose payment', () => {
    const action = primaryCheckoutAction({
      itemCount: 1,
      connected: false,
      onRobinhood: false,
      phase: { kind: 'browsing' },
      allowanceInsufficient: false,
      balanceInsufficient: false,
    });
    expect(action?.kind).toBe('connect_wallet');
    expect(action?.label).toBe('Connect wallet');
  });

  it('wrong network is Switch, sufficient payment_select is purchase', () => {
    expect(
      primaryCheckoutAction({
        itemCount: 1,
        connected: true,
        onRobinhood: false,
        phase: { kind: 'browsing' },
        allowanceInsufficient: false,
        balanceInsufficient: false,
      })?.kind,
    ).toBe('switch_network');
    expect(
      primaryCheckoutAction({
        itemCount: 1,
        connected: true,
        onRobinhood: true,
        phase: {
          kind: 'payment_select',
          items: [validRow('20343', 1.36, '1360000')],
          payment: { assetId: 'USDG' },
        },
        allowanceInsufficient: false,
        balanceInsufficient: true,
      })?.kind,
    ).toBe('insufficient_balance');
    expect(
      primaryCheckoutAction({
        itemCount: 1,
        connected: true,
        onRobinhood: true,
        phase: {
          kind: 'payment_select',
          items: [validRow('20343', 1.36, '1360000')],
          payment: { assetId: 'USDG' },
        },
        allowanceInsufficient: false,
        balanceInsufficient: false,
      })?.kind,
    ).toBe('purchase');
  });
});
