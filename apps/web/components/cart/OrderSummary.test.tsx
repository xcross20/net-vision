// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import {
  OrderSummary,
  type OrderSummaryRows,
  type OrderSummarySelectedAsset,
} from './OrderSummary';
import type { CheckoutItem } from '@/lib/cart/types';

// Avoid pulling viem via the icons barrel — react-only icon stubs.
vi.mock('@/components/icons', () => ({
  ArrowUR: () => null,
  CheckIcon: () => null,
}));

const USDG_AVAILABLE: OrderSummarySelectedAsset = {
  assetId: 'usdg',
  symbol: 'USDG',
  routeStatus: 'AVAILABLE',
};

const ETH_AVAILABLE: OrderSummarySelectedAsset = {
  assetId: 'eth',
  symbol: 'ETH',
  routeStatus: 'AVAILABLE',
};

const ETH_COMING_SOON: OrderSummarySelectedAsset = {
  assetId: 'eth',
  symbol: 'ETH',
  routeStatus: 'COMING_SOON',
};

function makeItem(): CheckoutItem {
  return {
    tokenId: '1',
    state: 'valid',
    cartItem: {
      collectionSlug: 'button-presser',
      tokenId: '1',
      imageUrl: 'https://example.test/img.png',
      contractAddress: '0x0000000000000068F116a894984e2DB1123eB395',
      displayName: 'Button Presser #1',
      categories: [
        { slug: 'iconic', label: 'Iconic' },
        { slug: 'rare', label: 'Rare' },
      ],
      sourceMarketplace: 'opensea',
      displayedOrderHash: null,
      displayedPriceRaw: null,
      displayedPriceDecimal: null,
      currencySymbol: null,
      currencyAddress: null,
      currencyDecimals: null,
      addedAt: 1,
    },
    liveOrderHash: '0x00',
    livePriceRaw: 1430000000n,
    livePriceDecimal: 6,
    livePriceDisplay: '1,430 USDG',
    liveCurrency: 'USDG',
    liveProtocolAddress: '0x0000000000000068F116a894984e2DB1123eB395',
    liveValidUntil: null,
    priceChanged: false,
  };
}

function makeRows(overrides: Partial<OrderSummaryRows> = {}): OrderSummaryRows {
  return {
    pay: '1.430 USDG',
    payEquivalentUsdg: null,
    purchaseValueUsdg: '1,430 USDG',
    fee: '0 USDG',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('OrderSummary — Selected-Payment Invariant enforcement', () => {
  it('renders Pay with the USDG amount and NO secondary line when USDG is selected and AVAILABLE', () => {
    render(
      <OrderSummary
        items={[makeItem()]}
        selectedAsset={USDG_AVAILABLE}
        orderSummaryRows={makeRows()}
        ctaLabel="Continue"
        ctaOnClick={() => {}}
      />,
    );
    expect(screen.getByText('1.430 USDG')).toBeTruthy();
    // No "≈ X USDG" secondary line.
    expect(screen.queryByText(/≈/)).toBeNull();
    // No "coming soon" copy on a USDG AVAILABLE row.
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('renders Pay with the SELECTED-asset amount + secondary USDG line when ETH is AVAILABLE', () => {
    render(
      <OrderSummary
        items={[makeItem()]}
        selectedAsset={ETH_AVAILABLE}
        orderSummaryRows={makeRows({
          pay: '0.000431 ETH',
          payEquivalentUsdg: '≈ 1.430 USDG',
        })}
        ctaLabel="Continue"
        ctaOnClick={() => {}}
      />,
    );
    expect(screen.getByText('0.000431 ETH')).toBeTruthy();
    expect(screen.getByText('≈ 1.430 USDG')).toBeTruthy();
    // Must NOT show the USDG pay amount as the primary Pay.
    expect(screen.queryByText('1.430 USDG')).toBeNull();
  });

  it('renders Pay with "—" and "<symbol> — coming soon" when the SELECTED non-USDG asset is COMING_SOON', () => {
    render(
      <OrderSummary
        items={[makeItem()]}
        selectedAsset={ETH_COMING_SOON}
        orderSummaryRows={makeRows({
          pay: '—',
          payEquivalentUsdg: 'ETH — coming soon',
        })}
        ctaLabel="Continue"
        ctaOnClick={() => {}}
      />,
    );
    // Em dash for the amount.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // "ETH — coming soon" appears in the secondary.
    expect(screen.getByText(/ETH.*coming soon/i)).toBeTruthy();
  });

  it('always renders Purchase value and Marketplace fee as USDG', () => {
    // ETH selected — Purchase value & fee must STILL be USDG, never ETH.
    render(
      <OrderSummary
        items={[makeItem()]}
        selectedAsset={ETH_AVAILABLE}
        orderSummaryRows={makeRows({
          pay: '0.000431 ETH',
          payEquivalentUsdg: '≈ 1.430 USDG',
          purchaseValueUsdg: '1,430 USDG',
          fee: '28.60 USDG',
        })}
        ctaLabel="Continue"
        ctaOnClick={() => {}}
      />,
    );
    expect(screen.getByText('1,430 USDG')).toBeTruthy();
    expect(screen.getByText('28.60 USDG')).toBeTruthy();
    // Primary Pay row IS the ETH amount (that's correct when ETH is
    // selected) — but Purchase value and Marketplace fee MUST be USDG.
    // The Pay amount and the secondary "≈" line are the only places ETH
    // should appear in this view.
    expect(screen.getByText('0.000431 ETH')).toBeTruthy();
    // Negative checks: no fee row in ETH, no purchase value in ETH.
    expect(screen.queryByText(/ETH fee/i)).toBeNull();
  });

  it('feature line refers to crypto-fee when assetId is a crypto asset (usdg/eth/netnet-net)', () => {
    render(
      <OrderSummary
        items={[makeItem()]}
        selectedAsset={USDG_AVAILABLE}
        orderSummaryRows={makeRows()}
        ctaLabel="Continue"
        ctaOnClick={() => {}}
      />,
    );
    expect(screen.getByText(/No fees with crypto payments/i)).toBeTruthy();
  });

  it('feature line refers to stock-token 2% fee when assetId is a stock token', () => {
    render(
      <OrderSummary
        items={[makeItem()]}
        selectedAsset={{
          assetId: 'rh-aapl',
          symbol: 'AAPL',
          routeStatus: 'COMING_SOON',
        }}
        orderSummaryRows={makeRows({
          pay: '—',
          payEquivalentUsdg: 'AAPL — coming soon',
        })}
        ctaLabel="Continue"
        ctaOnClick={() => {}}
      />,
    );
    expect(screen.getByText(/Stock Token payments carry a 2% service fee/i)).toBeTruthy();
  });
});