// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PaymentStatusFooter } from './PaymentStatusFooter';
import type { SelectedPaymentStatus } from '@/lib/payment/selected-payment-status';
import type { Address } from 'viem';

// Each test renders into the shared happy-dom document — clean up between
// runs so renders don't accumulate.
afterEach(() => {
  cleanup();
});

function makeStatus(overrides: Partial<SelectedPaymentStatus>): SelectedPaymentStatus {
  return {
    assetId: 'usdg',
    symbol: 'USDG',
    decimals: 6,
    routeStatus: 'AVAILABLE',
    routeReasonCode: null,
    routeNote: null,
    quoteId: 'q1',
    requiredInputRaw: '1430000000',
    balance: { state: 'KNOWN_SUFFICIENT', raw: '1500000000' },
    allowance: {
      kind: 'REQUIRED',
      spender: '0x0000000000000068F116a894984e2DB1123eB395' as Address,
      allowance: { state: 'KNOWN_SUFFICIENT', raw: '1500000000' },
    },
    purchaseValueUsdgRaw: '1430000000',
    serviceFeeBps: 0,
    serviceFeeRaw: '0',
    ...overrides,
  };
}

describe('PaymentStatusFooter — Selected-Payment Invariant enforcement', () => {
  it('renders the USDG balance line when USDG is the selected asset', () => {
    render(<PaymentStatusFooter status={makeStatus({})} />);
    // 1500000000 raw / 10^6 decimals = 1500 USDG → "1,500 USDG".
    expect(screen.getByText(/USDG balance:/)).toBeTruthy();
    // Balance and allowance happen to share the same number here — assert
    // both render, plus the distinct USDG required amount.
    expect(screen.getAllByText('1,500 USDG').length).toBe(2);
    expect(screen.getByText('1,430 USDG')).toBeTruthy();
  });

  it('renders the ETH balance line when ETH is the selected asset (not USDG)', () => {
    // 1000000000000000000 raw / 10^18 = 1 ETH → "1.000 ETH".
    render(
      <PaymentStatusFooter
        status={makeStatus({
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balance: { state: 'KNOWN_SUFFICIENT', raw: '1000000000000000000' },
          requiredInputRaw: '431000000000000000',
          allowance: { kind: 'NOT_REQUIRED' },
        })}
      />,
    );
    expect(screen.getByText(/ETH balance:/)).toBeTruthy();
    expect(screen.getByText('1.000 ETH')).toBeTruthy();
    // Required row should NOT show "USDG" — it must use the selected symbol.
    // The label "Required:" sits in a parent <span> and the amount in a
    // nested <span>, so we assert on the rendered value directly.
    expect(screen.getByText('0.4310 ETH')).toBeTruthy();
    expect(screen.queryByText('1,430 USDG')).toBeNull();
  });

  it('renders "Allowance: not required" for native ETH (NOT_REQUIRED allowance)', () => {
    render(
      <PaymentStatusFooter
        status={makeStatus({
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          allowance: { kind: 'NOT_REQUIRED' },
        })}
      />,
    );
    expect(screen.getByText(/Allowance:/)).toBeTruthy();
    expect(screen.getByText(/not required/i)).toBeTruthy();
  });

  it('renders the allowance amount for ERC20 assets (REQUIRED allowance)', () => {
    render(
      <PaymentStatusFooter
        status={makeStatus({
          assetId: 'rh-aapl',
          symbol: 'AAPL',
          decimals: 18,
          allowance: {
            kind: 'REQUIRED',
            spender: '0x0000000000000000000000000000000000000abc' as Address,
            allowance: { state: 'KNOWN_INSUFFICIENT', raw: '1000000000000000000' },
          },
        })}
      />,
    );
    // 1e18 raw at 18 decimals = 1 AAPL → "1.000 AAPL" (not USDG).
    expect(screen.getByText(/Allowance:/)).toBeTruthy();
    expect(screen.getByText('1.000 AAPL')).toBeTruthy();
    expect(screen.queryByText(/Allowance:.*USDG/)).toBeNull();
  });

  it('renders "unknown" when balance is UNKNOWN (never 0)', () => {
    render(
      <PaymentStatusFooter
        status={makeStatus({
          balance: { state: 'UNKNOWN', raw: null },
        })}
      />,
    );
    expect(screen.getByText(/USDG balance:/)).toBeTruthy();
    expect(screen.getByText('unknown')).toBeTruthy();
    // MUST NOT show "0 USDG" — the old bug.
    expect(screen.queryByText('0 USDG')).toBeNull();
  });

  it('renders the Insufficient warning with the SELECTED symbol (not USDG)', () => {
    render(
      <PaymentStatusFooter
        status={makeStatus({
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          balance: { state: 'KNOWN_INSUFFICIENT', raw: '1000000000000000000' },
          requiredInputRaw: '5000000000000000000',
          allowance: { kind: 'NOT_REQUIRED' },
        })}
      />,
    );
    expect(screen.getByText(/Insufficient ETH\./)).toBeTruthy();
    // MUST NOT say "Insufficient USDG" — that was the original bug.
    expect(screen.queryByText(/Insufficient USDG/)).toBeNull();
  });

  it('formats the required amount with the SELECTED asset decimals', () => {
    // 18-decimal raw '431000000000000000' = 0.431 ETH → "0.4310 ETH".
    render(
      <PaymentStatusFooter
        status={makeStatus({
          assetId: 'eth',
          symbol: 'ETH',
          decimals: 18,
          requiredInputRaw: '431000000000000000',
          allowance: { kind: 'NOT_REQUIRED' },
        })}
      />,
    );
    expect(screen.getByText('0.4310 ETH')).toBeTruthy();
    // MUST NOT render the value as USDG.
    expect(screen.queryByText(/1,430 USDG/)).toBeNull();
  });
});