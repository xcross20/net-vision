// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  CheckoutPaymentPicker,
  type PaymentAvailability,
} from './CheckoutPaymentPicker';
import type { PaymentAsset } from '@net-vision/payment-router';

// Icons barrel pulls in heavy deps — stub the symbols we use.
vi.mock('@/components/icons', () => ({
  Hex: () => null,
  CheckIcon: () => null,
}));

// StockTickerGlyph pulls in extra deps — stub it.
vi.mock('./StockTickerGlyph', () => ({
  StockTickerGlyph: () => null,
}));

function makeAsset(overrides: Partial<PaymentAsset> = {}): PaymentAsset {
  return {
    assetId: 'usdg',
    displayName: 'USDG',
    symbol: 'USDG',
    chainId: 4663,
    kind: 'stablecoin',
    decimals: 6,
    status: 'ENABLED',
    feeBps: 0,
    settlementRoutes: [],
    ...overrides,
  };
}

const USDG_ASSET = makeAsset();
const ETH_ASSET = makeAsset({
  assetId: 'eth',
  displayName: 'Ethereum',
  symbol: 'ETH',
  kind: 'native',
  decimals: 18,
});
const NET_ASSET = makeAsset({
  assetId: 'netnet-net',
  displayName: 'NetNet',
  symbol: 'NET',
  kind: 'protocol-token',
  decimals: 18,
});
const AAPL_ASSET = makeAsset({
  assetId: 'rh-aapl',
  displayName: 'Apple',
  symbol: 'AAPL',
  kind: 'stock-token',
  decimals: 18,
  feeBps: 200,
});

afterEach(() => {
  cleanup();
});

describe('CheckoutPaymentPicker — Selected-Payment Invariant enforcement', () => {
  it('renders USDG tile as enabled when routeStatus is AVAILABLE', () => {
    const onSelect = vi.fn();
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, ETH_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          { assetId: 'eth', available: false, feeBps: 0, routeStatus: 'COMING_SOON' },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={onSelect}
      />,
    );
    const usdgButton = screen.getByRole('button', { name: /USDG/i });
    expect(usdgButton.hasAttribute('disabled')).toBe(false);
    expect(usdgButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders ETH tile as DISABLED when routeStatus is COMING_SOON (not selectable)', () => {
    const onSelectCrypto = vi.fn();
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, ETH_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          { assetId: 'eth', available: false, feeBps: 0, routeStatus: 'COMING_SOON' },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={onSelectCrypto}
      />,
    );
    const ethButton = screen.getByRole('button', { name: /ETH/i });
    expect(ethButton.hasAttribute('disabled')).toBe(true);
    // Clicking the disabled ETH tile must NOT trigger a selection.
    fireEvent.click(ethButton);
    expect(onSelectCrypto).not.toHaveBeenCalled();
  });

  it('renders NET tile as DISABLED when routeStatus is COMING_SOON', () => {
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, NET_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          { assetId: 'netnet-net', available: false, feeBps: 0, routeStatus: 'COMING_SOON' },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={() => {}}
      />,
    );
    const netButton = screen.getByRole('button', { name: /NET/i });
    expect(netButton.hasAttribute('disabled')).toBe(true);
  });

  it('renders AAPL stock-token tile as DISABLED when routeStatus is COMING_SOON', () => {
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, AAPL_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          { assetId: 'rh-aapl', available: false, feeBps: 200, routeStatus: 'COMING_SOON' },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={() => {}}
      />,
    );
    const aaplButton = screen.getByRole('button', { name: /AAPL/i });
    expect(aaplButton.hasAttribute('disabled')).toBe(true);
  });

  it('uses routeStatus (NOT legacy `available`) as the gate — disabled ETH does NOT become enabled when `available` is true but routeStatus is COMING_SOON', () => {
    // This is the regression test for the original bug: ETH had
    // `available: true` (policy-allowed) AND `routeStatus: COMING_SOON`
    // (no router pinned). Old code conflates them and treats it as
    // selectable. Correct behavior: routeStatus wins, tile is disabled.
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, ETH_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          {
            assetId: 'eth',
            available: true /* LEGACY FIELD */,
            feeBps: 0,
            routeStatus: 'COMING_SOON',
          },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={() => {}}
      />,
    );
    const ethButton = screen.getByRole('button', { name: /ETH/i });
    expect(ethButton.hasAttribute('disabled')).toBe(true);
  });

  it('renders "Region restricted" disabled label for REGION_RESTRICTED assets', () => {
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, AAPL_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          {
            assetId: 'rh-aapl',
            available: false,
            feeBps: 200,
            routeStatus: 'REGION_RESTRICTED',
            routeReasonCode: 'JURISDICTION_BLOCKED',
          },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={() => {}}
      />,
    );
    expect(screen.getAllByText(/Region restricted/i).length).toBeGreaterThan(0);
    const aaplButton = screen.getByRole('button', { name: /AAPL/i });
    expect(aaplButton.hasAttribute('disabled')).toBe(true);
  });

  it('renders "Coming soon" chip for COMING_SOON assets', () => {
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, ETH_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          { assetId: 'eth', available: false, feeBps: 0, routeStatus: 'COMING_SOON' },
        ]}
        selectedAssetId="usdg"
        onSelect={() => {}}
        onSelectCrypto={() => {}}
      />,
    );
    expect(screen.getAllByText(/Coming soon/i).length).toBeGreaterThan(0);
  });

  it('routes AVAILABLE selection to onSelectCrypto for crypto assets', () => {
    const onSelectCrypto = vi.fn();
    render(
      <CheckoutPaymentPicker
        assets={[USDG_ASSET, ETH_ASSET]}
        availability={[
          { assetId: 'usdg', available: true, feeBps: 0, routeStatus: 'AVAILABLE' },
          { assetId: 'eth', available: false, feeBps: 0, routeStatus: 'COMING_SOON' },
        ]}
        selectedAssetId="eth"
        onSelect={() => {}}
        onSelectCrypto={onSelectCrypto}
      />,
    );
    // Click the (selected) USDG tile — should call onSelectCrypto.
    const usdgButton = screen.getByRole('button', { name: /USDG/i });
    fireEvent.click(usdgButton);
    expect(onSelectCrypto).toHaveBeenCalledWith('usdg');
  });
});