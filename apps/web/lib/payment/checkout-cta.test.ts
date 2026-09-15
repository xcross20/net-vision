import { describe, expect, it } from 'vitest';

import type {
  AllowanceState,
  AmountKnowledge,
  SelectedPaymentStatus,
} from './selected-payment-status';
import {
  deriveCheckoutCta,
  formatAssetAmount,
  formatSelectedAmount,
} from './checkout-cta';

const SUFFICIENT: AmountKnowledge = { state: 'KNOWN_SUFFICIENT', raw: '1500000000' };
const INSUFFICIENT: AmountKnowledge = { state: 'KNOWN_INSUFFICIENT', raw: '100000000' };
const UNKNOWN_BALANCE: AmountKnowledge = { state: 'UNKNOWN', raw: null };

const ALLOW_SUFFICIENT: AllowanceState = {
  kind: 'REQUIRED',
  spender: '0x0000000000000000000000000000000000000001',
  allowance: SUFFICIENT,
};
const ALLOW_INSUFFICIENT: AllowanceState = {
  kind: 'REQUIRED',
  spender: '0x0000000000000000000000000000000000000001',
  allowance: INSUFFICIENT,
};
const ALLOW_UNKNOWN: AllowanceState = {
  kind: 'REQUIRED',
  spender: '0x0000000000000000000000000000000000000001',
  allowance: UNKNOWN_BALANCE,
};
const ALLOW_NO_SPENDER: AllowanceState = {
  kind: 'REQUIRED',
  spender: null,
  allowance: SUFFICIENT,
};
const ALLOW_NOT_REQUIRED: AllowanceState = { kind: 'NOT_REQUIRED' };

const ASSETS = [
  { assetId: 'usdg', symbol: 'USDG', decimals: 6 },
  { assetId: 'eth', symbol: 'ETH', decimals: 18 },
  { assetId: 'netnet-net', symbol: 'NET', decimals: 18 },
  { assetId: 'rh-aapl', symbol: 'AAPL', decimals: 8 },
  { assetId: 'rh-nvda', symbol: 'NVDA', decimals: 8 },
  { assetId: 'rh-tsla', symbol: 'TSLA', decimals: 8 },
  { assetId: 'rh-coin', symbol: 'COIN', decimals: 8 },
  { assetId: 'rh-msft', symbol: 'MSFT', decimals: 8 },
  { assetId: 'rh-spy', symbol: 'SPY', decimals: 8 },
  { assetId: 'rh-googl', symbol: 'GOOGL', decimals: 8 },
  { assetId: 'rh-amzn', symbol: 'AMZN', decimals: 8 },
  { assetId: 'rh-spcx', symbol: 'SPCX', decimals: 8 },
] as const;

function statusFor(
  asset: { assetId: string; symbol: string; decimals: number },
  overrides: Partial<SelectedPaymentStatus>,
): SelectedPaymentStatus {
  return {
    assetId: asset.assetId,
    symbol: asset.symbol,
    decimals: asset.decimals,
    routeStatus: 'AVAILABLE',
    routeReasonCode: null,
    routeNote: null,
    quoteId: 'q1',
    requiredInputRaw: '1430000000',
    balance: SUFFICIENT,
    allowance: ALLOW_SUFFICIENT,
    purchaseValueUsdgRaw: '1430000000',
    serviceFeeBps: 0,
    serviceFeeRaw: '0',
    ...overrides,
  };
}

const CONNECTED = { isConnected: true, onRobinhood: true, cartItemCount: 3, canBuy: true };

describe('formatAssetAmount', () => {
  it('returns null for null input', () => {
    expect(formatAssetAmount(null, 6)).toBeNull();
  });

  it('returns 0 for zero raw', () => {
    expect(formatAssetAmount('0', 6)).toBe(0);
  });

  it('scales by decimals', () => {
    // 1500000000 with 6 decimals = 1500
    expect(formatAssetAmount('1500000000', 6)).toBe(1500);
    // 1 ETH with 18 decimals = 1
    expect(formatAssetAmount('1000000000000000000', 18)).toBe(1);
    // 1 sat with 8 decimals (1 unit of a stock token) = 1
    expect(formatAssetAmount('100000000', 8)).toBe(1);
  });

  it('returns null for non-numeric input', () => {
    expect(formatAssetAmount('not-a-number', 6)).toBeNull();
  });

  it('returns null for negative input', () => {
    expect(formatAssetAmount('-1', 6)).toBeNull();
  });
});

describe('formatSelectedAmount', () => {
  it('renders 0 with the symbol', () => {
    expect(formatSelectedAmount('0', 6, 'USDG')).toBe('0 USDG');
  });

  it('renders fractional values with 4 decimals when below 1', () => {
    // 431000 with 6 decimals = 0.431
    expect(formatSelectedAmount('431000', 6, 'USDG')).toBe('0.4310 USDG');
  });

  it('renders values >= 1000 with thousands separators (no forced decimals)', () => {
    // 1430000000 with 6 decimals = 1430 — large enough that toLocaleString
    // takes over and toFixed padding is skipped.
    expect(formatSelectedAmount('1430000000', 6, 'USDG')).toBe('1,430 USDG');
  });

  it('renders values between 1 and 1000 with 3 decimals', () => {
    // 1430000 with 6 decimals = 1.43
    expect(formatSelectedAmount('1430000', 6, 'USDG')).toBe('1.430 USDG');
  });

  it('renders 0 with USDG when raw is null', () => {
    expect(formatSelectedAmount(null, 6, 'USDG')).toBe('0 USDG');
  });
});

describe('deriveCheckoutCta — wallet + network gates', () => {
  it('returns Connect wallet when the wallet is not connected, regardless of selected asset', () => {
    for (const asset of ASSETS) {
      const result = deriveCheckoutCta({
        selected: statusFor(asset, {}),
        isConnected: false,
        onRobinhood: true,
        cartItemCount: 3,
        canBuy: true,
      });
      expect(result.kind).toBe('wallet_required');
      if (result.kind === 'wallet_required') {
        expect(result.label).toBe('Connect wallet');
      }
    }
  });

  it('returns Switch to Robinhood Chain when on the wrong chain, regardless of selected asset', () => {
    for (const asset of ASSETS) {
      const result = deriveCheckoutCta({
        selected: statusFor(asset, {}),
        isConnected: true,
        onRobinhood: false,
        cartItemCount: 3,
        canBuy: true,
      });
      expect(result.kind).toBe('switch_network');
      if (result.kind === 'switch_network') {
        expect(result.label).toBe('Switch to Robinhood Chain');
      }
    }
  });

  it('returns review_required when the cart is empty', () => {
    const result = deriveCheckoutCta({
      selected: null,
      isConnected: true,
      onRobinhood: true,
      cartItemCount: 0,
      canBuy: true,
    });
    expect(result.kind).toBe('review_required');
    if (result.kind === 'review_required') {
      expect(result.label).toBe('Cart is empty');
    }
  });

  it('returns review_required when canBuy is false (drifted prices not accepted)', () => {
    const result = deriveCheckoutCta({
      selected: statusFor(ASSETS[0], {}),
      isConnected: true,
      onRobinhood: true,
      cartItemCount: 3,
      canBuy: false,
    });
    expect(result.kind).toBe('review_required');
    if (result.kind === 'review_required') {
      expect(result.label).toBe('Review 3 items');
    }
  });

  it('singularises the review label for 1 item', () => {
    const result = deriveCheckoutCta({
      selected: null,
      isConnected: true,
      onRobinhood: true,
      cartItemCount: 1,
      canBuy: false,
    });
    if (result.kind === 'review_required') {
      expect(result.label).toBe('Review 1 item');
    }
  });

  it('returns review_required when no payment method is selected', () => {
    const result = deriveCheckoutCta({
      selected: null,
      isConnected: true,
      onRobinhood: true,
      cartItemCount: 3,
      canBuy: true,
    });
    expect(result.kind).toBe('review_required');
    if (result.kind === 'review_required') {
      expect(result.label).toBe('Choose payment method');
    }
  });
});

describe('deriveCheckoutCta — payment matrix (12 assets × 9 rows)', () => {
  type Row = {
    label: string;
    overrides: Partial<SelectedPaymentStatus>;
    expectedKind: 'continue' | 'approve' | 'insufficient' | 'route_unavailable';
    matchLabel: (symbol: string, status: SelectedPaymentStatus) => string;
  };

  const rows: Row[] = [
    {
      label: 'AVAILABLE + SUFFICIENT balance + SUFFICIENT allowance → continue',
      overrides: {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_SUFFICIENT,
      },
      expectedKind: 'continue',
      matchLabel: () => 'Continue to Review',
    },
    {
      label: 'AVAILABLE + SUFFICIENT balance + INSUFFICIENT allowance → approve',
      overrides: {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_INSUFFICIENT,
        requiredInputRaw: '1430000000',
      },
      expectedKind: 'approve',
      matchLabel: (symbol, status) =>
        `Approve ${formatSelectedAmount('1430000000', status.decimals, symbol)}`,
    },
    {
      label: 'AVAILABLE + SUFFICIENT balance + UNKNOWN allowance → route_unavailable (allowance unresolved)',
      overrides: {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_UNKNOWN,
      },
      expectedKind: 'route_unavailable',
      matchLabel: (symbol) => `${symbol} allowance unresolved`,
    },
    {
      label: 'AVAILABLE + SUFFICIENT balance + REQUIRED allowance but spender=null → route_unavailable (spender unresolved)',
      overrides: {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_NO_SPENDER,
      },
      expectedKind: 'route_unavailable',
      matchLabel: (symbol) => `${symbol} spender unresolved`,
    },
    {
      label: 'AVAILABLE + INSUFFICIENT balance → insufficient',
      overrides: {
        routeStatus: 'AVAILABLE',
        balance: INSUFFICIENT,
        allowance: ALLOW_SUFFICIENT,
      },
      expectedKind: 'insufficient',
      matchLabel: (symbol) => `Insufficient ${symbol}`,
    },
    {
      label: 'AVAILABLE + UNKNOWN balance → route_unavailable (balance unknown)',
      overrides: {
        routeStatus: 'AVAILABLE',
        balance: UNKNOWN_BALANCE,
        allowance: ALLOW_SUFFICIENT,
      },
      expectedKind: 'route_unavailable',
      matchLabel: (symbol) => `${symbol} balance unknown — try again`,
    },
    {
      label: 'COMING_SOON → route_unavailable (payments not available yet)',
      overrides: {
        routeStatus: 'COMING_SOON',
        balance: SUFFICIENT,
        allowance: ALLOW_NOT_REQUIRED,
      },
      expectedKind: 'route_unavailable',
      matchLabel: (symbol) => `${symbol} payments not available yet`,
    },
    {
      label: 'REGION_RESTRICTED (stock) → route_unavailable (region)',
      overrides: {
        routeStatus: 'REGION_RESTRICTED',
        balance: SUFFICIENT,
        allowance: ALLOW_NO_SPENDER,
      },
      expectedKind: 'route_unavailable',
      matchLabel: (symbol, status) => {
        const isStock =
          status.symbol !== 'USDG' && status.symbol !== 'ETH' && status.symbol !== 'NET';
        return isStock
          ? 'Stock payments not available in your region'
          : `${symbol} payments not available in your region`;
      },
    },
    {
      label: 'UNSUPPORTED → route_unavailable (payments not available yet)',
      overrides: {
        routeStatus: 'UNSUPPORTED',
        balance: SUFFICIENT,
        allowance: ALLOW_SUFFICIENT,
      },
      expectedKind: 'route_unavailable',
      matchLabel: (symbol) => `${symbol} payments not available yet`,
    },
  ];

  it.each(
    ASSETS.flatMap((asset) =>
      rows.map((row) => ({
        assetId: asset.assetId,
        symbol: asset.symbol,
        decimals: asset.decimals,
        row,
      })),
    ),
  )(
    '$assetId ($symbol): $row.label',
    ({ assetId, symbol, decimals, row }) => {
      const status = statusFor({ assetId, symbol, decimals }, row.overrides);
      const result = deriveCheckoutCta({
        selected: status,
        ...CONNECTED,
      });
      expect(result.kind).toBe(row.expectedKind);
      const expectedLabel = row.matchLabel(symbol, status);
      if (result.kind === 'continue') {
        expect(result.label).toBe('Continue to Review');
      } else if (result.kind === 'approve') {
        expect(result.label).toBe(expectedLabel);
      } else if (result.kind === 'insufficient') {
        expect(result.label).toBe(expectedLabel);
      } else if (result.kind === 'route_unavailable') {
        expect(result.label).toBe(expectedLabel);
      } else if (result.kind === 'wallet_required') {
        expect(result.label).toBe('Connect wallet');
      } else if (result.kind === 'switch_network') {
        expect(result.label).toBe('Switch to Robinhood Chain');
      } else if (result.kind === 'review_required') {
        expect(result.label).toBe(expectedLabel);
      }
    },
  );

  it('approve label falls back to "Approve <symbol>" when requiredInputRaw is null', () => {
    const status = statusFor(
      { assetId: 'usdg', symbol: 'USDG', decimals: 6 },
      {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_INSUFFICIENT,
        requiredInputRaw: null,
      },
    );
    const result = deriveCheckoutCta({
      selected: status,
      ...CONNECTED,
    });
    expect(result.kind).toBe('approve');
    if (result.kind === 'approve') {
      expect(result.label).toBe('Approve USDG');
    }
  });

  it('insufficient wins over approve when balance is insufficient AND allowance is insufficient', () => {
    // The invariant says: balance gate (insufficient) is consulted BEFORE
    // allowance gate (approve). The user cannot approve their way past
    // insufficient balance — they'd just be approving a higher allowance
    // for a balance they don't have.
    const status = statusFor(
      { assetId: 'usdg', symbol: 'USDG', decimals: 6 },
      {
        routeStatus: 'AVAILABLE',
        balance: INSUFFICIENT,
        allowance: ALLOW_INSUFFICIENT,
      },
    );
    const result = deriveCheckoutCta({
      selected: status,
      ...CONNECTED,
    });
    expect(result.kind).toBe('insufficient');
  });

  it('route_unavailable wins over insufficient when routeStatus is COMING_SOON even with insufficient balance', () => {
    // The invariant says: route gate fires before balance gate. We must
    // never report "Insufficient ETH" when ETH settlement isn't live,
    // because there is no authoritative required-ETH amount to be
    // insufficient against.
    const status = statusFor(
      { assetId: 'eth', symbol: 'ETH', decimals: 18 },
      {
        routeStatus: 'COMING_SOON',
        balance: INSUFFICIENT,
        allowance: ALLOW_NOT_REQUIRED,
      },
    );
    const result = deriveCheckoutCta({
      selected: status,
      ...CONNECTED,
    });
    expect(result.kind).toBe('route_unavailable');
    if (result.kind === 'route_unavailable') {
      expect(result.label).toBe('ETH payments not available yet');
    }
  });

  it('approve wins over insufficient when balance is sufficient but allowance is insufficient', () => {
    const status = statusFor(
      { assetId: 'usdg', symbol: 'USDG', decimals: 6 },
      {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_INSUFFICIENT,
      },
    );
    const result = deriveCheckoutCta({
      selected: status,
      ...CONNECTED,
    });
    expect(result.kind).toBe('approve');
  });

  it('NOT_REQUIRED allowance (native ETH) skips the approve gate', () => {
    const status = statusFor(
      { assetId: 'eth', symbol: 'ETH', decimals: 18 },
      {
        routeStatus: 'AVAILABLE',
        balance: SUFFICIENT,
        allowance: ALLOW_NOT_REQUIRED,
      },
    );
    const result = deriveCheckoutCta({
      selected: status,
      ...CONNECTED,
    });
    expect(result.kind).toBe('continue');
  });
});

describe('deriveCheckoutCta — order of precedence (invariants)', () => {
  it('wallet_required beats all other states', () => {
    const status = statusFor(
      { assetId: 'usdg', symbol: 'USDG', decimals: 6 },
      { routeStatus: 'AVAILABLE', balance: INSUFFICIENT, allowance: ALLOW_INSUFFICIENT },
    );
    const result = deriveCheckoutCta({
      selected: status,
      isConnected: false,
      onRobinhood: true,
      cartItemCount: 3,
      canBuy: true,
    });
    expect(result.kind).toBe('wallet_required');
  });

  it('switch_network beats route gates and balance gates', () => {
    const status = statusFor(
      { assetId: 'usdg', symbol: 'USDG', decimals: 6 },
      { routeStatus: 'COMING_SOON', balance: INSUFFICIENT },
    );
    const result = deriveCheckoutCta({
      selected: status,
      isConnected: true,
      onRobinhood: false,
      cartItemCount: 3,
      canBuy: true,
    });
    expect(result.kind).toBe('switch_network');
  });

  it('USDG state does NOT leak into non-USDG selections', () => {
    // The original bug: USDG balance/allowance state drove the CTA even
    // when ETH was selected. Pin the invariant that the selected asset's
    // own state is the only authority.
    const ethStatus = statusFor(
      { assetId: 'eth', symbol: 'ETH', decimals: 18 },
      { routeStatus: 'COMING_SOON' },
    );
    const result = deriveCheckoutCta({
      selected: ethStatus,
      ...CONNECTED,
    });
    expect(result.kind).toBe('route_unavailable');
    if (result.kind === 'route_unavailable') {
      // MUST NOT say "Insufficient USDG"
      expect(result.label).not.toContain('USDG');
      expect(result.label).toBe('ETH payments not available yet');
    }
  });
});