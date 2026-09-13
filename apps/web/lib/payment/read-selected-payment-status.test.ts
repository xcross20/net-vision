import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readSelectedPaymentStatus, routeStatusFromPolicy } from './read-selected-payment-status';
import type { PaymentPolicyDecision } from '@net-vision/payment-router';

// Mock readUsdgStatus so the AVAILABLE branch is testable without an RPC.
vi.mock('@/lib/trade/usdg-status', () => ({
  readUsdgStatus: vi.fn(async () => ({
    chainId: 4663,
    token: {
      address: '0x5fc5360d0400a0fd4f2af552add042d716f1d168',
      decimals: 6,
      symbol: 'USDG',
    },
    spender: {
      address: '0x0000000000000068F116a894984e2DB1123eB395',
      source: 'seaport-direct' as const,
      conduitKey: null,
      note: 'Spender is Seaport (zero conduitKey).',
    },
    balance: { state: 'KNOWN_SUFFICIENT' as const, raw: '1500000000' },
    allowance: { state: 'KNOWN_SUFFICIENT' as const, raw: '1500000000' },
  })),
}));

const BUYER = '0x0000000000000000000000000000000000000abc' as `0x${string}`;

describe('routeStatusFromPolicy', () => {
  it('returns AVAILABLE when the policy is allowed and the route is executable', () => {
    const policy: PaymentPolicyDecision = {
      assetId: 'usdg',
      available: true,
      feeBps: 0,
      jurisdiction: 'ALLOWED',
      routeStatus: 'AVAILABLE',
      policyVersion: 'payment-policy-v3',
    };
    expect(routeStatusFromPolicy(policy)).toBe('AVAILABLE');
  });

  it('returns REGION_RESTRICTED when jurisdiction is BLOCKED', () => {
    const policy: PaymentPolicyDecision = {
      assetId: 'rh-aapl',
      available: false,
      feeBps: 200,
      jurisdiction: 'BLOCKED',
      routeStatus: 'UNAVAILABLE',
      reasonCode: 'REGION_RESTRICTED',
      policyVersion: 'payment-policy-v3',
    };
    expect(routeStatusFromPolicy(policy)).toBe('REGION_RESTRICTED');
  });

  it('returns REGION_RESTRICTED when jurisdiction is UNKNOWN', () => {
    const policy: PaymentPolicyDecision = {
      assetId: 'rh-aapl',
      available: false,
      feeBps: 200,
      jurisdiction: 'UNKNOWN',
      routeStatus: 'UNAVAILABLE',
      reasonCode: 'REGION_UNKNOWN',
      policyVersion: 'payment-policy-v3',
    };
    expect(routeStatusFromPolicy(policy)).toBe('REGION_RESTRICTED');
  });

  it('returns UNSUPPORTED when the asset is explicitly disabled', () => {
    const policy: PaymentPolicyDecision = {
      assetId: 'rh-net-cloudflare',
      available: false,
      feeBps: 200,
      jurisdiction: 'ALLOWED',
      routeStatus: 'UNAVAILABLE',
      reasonCode: 'ASSET_DISABLED',
      policyVersion: 'payment-policy-v3',
    };
    expect(routeStatusFromPolicy(policy)).toBe('UNSUPPORTED');
  });

  it('returns COMING_SOON when the asset is enabled but has no executable route', () => {
    const policy: PaymentPolicyDecision = {
      assetId: 'eth',
      available: true,
      feeBps: 0,
      jurisdiction: 'ALLOWED',
      routeStatus: 'UNAVAILABLE',
      policyVersion: 'payment-policy-v3',
    };
    expect(routeStatusFromPolicy(policy)).toBe('COMING_SOON');
  });
});

describe('readSelectedPaymentStatus — USDG AVAILABLE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a full USDG status with balance + allowance when route is AVAILABLE', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'usdg',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'US',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.assetId).toBe('usdg');
    expect(result.status.symbol).toBe('USDG');
    expect(result.status.decimals).toBe(6);
    expect(result.status.routeStatus).toBe('AVAILABLE');
    expect(result.status.balance.state).toBe('KNOWN_SUFFICIENT');
    expect(result.status.allowance.kind).toBe('REQUIRED');
    if (result.status.allowance.kind === 'REQUIRED') {
      expect(result.status.allowance.allowance.state).toBe('KNOWN_SUFFICIENT');
    }
    expect(result.status.requiredInputRaw).toBe('1430000000');
    expect(result.status.purchaseValueUsdgRaw).toBe('1430000000');
    expect(result.status.serviceFeeBps).toBe(0);
    expect(result.status.serviceFeeRaw).toBe('0');
  });

  it('reports UNKNOWN balance when requiredUsdgRaw is null even with a live USDG balance', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'usdg',
      requiredUsdgRaw: null,
      conduitKey: null,
      country: 'US',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.requiredInputRaw).toBeNull();
    expect(result.status.purchaseValueUsdgRaw).toBeNull();
  });
});

describe('readSelectedPaymentStatus — non-USDG assets short-circuit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns COMING_SOON for ETH in any region', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'eth',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'US',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.assetId).toBe('eth');
    expect(result.status.symbol).toBe('ETH');
    expect(result.status.routeStatus).toBe('COMING_SOON');
    expect(result.status.requiredInputRaw).toBeNull();
    expect(result.status.balance).toEqual({ state: 'UNKNOWN', raw: null });
    expect(result.status.allowance).toEqual({ kind: 'NOT_REQUIRED' });
  });

  it('returns COMING_SOON for NET in any region', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'netnet-net',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'DE',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.routeStatus).toBe('COMING_SOON');
    expect(result.status.symbol).toBe('NET');
    expect(result.status.decimals).toBe(9);
  });

  it('returns REGION_RESTRICTED for AAPL in US', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'rh-aapl',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'US',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.routeStatus).toBe('REGION_RESTRICTED');
    expect(result.status.symbol).toBe('AAPL');
    expect(result.status.routeReasonCode).toBe('REGION_RESTRICTED');
    expect(result.status.balance).toEqual({ state: 'UNKNOWN', raw: null });
    if (result.status.allowance.kind === 'REQUIRED') {
      expect(result.status.allowance.spender).toBeNull();
    }
  });

  it('returns REGION_RESTRICTED for AAPL when country is unknown (XX / T1)', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'rh-aapl',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.routeStatus).toBe('REGION_RESTRICTED');
    expect(result.status.routeReasonCode).toBe('REGION_UNKNOWN');
  });

  it('returns COMING_SOON for AAPL in DE (non-US, non-blocked)', async () => {
    // jurisdiction ALLOWED + routeStatus UNAVAILABLE → COMING_SOON.
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'rh-aapl',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'DE',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.routeStatus).toBe('COMING_SOON');
    expect(result.status.serviceFeeBps).toBe(200);
  });

  it('returns UNSUPPORTED for the disabled Cloudflare NET (rh-net-cloudflare)', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'rh-net-cloudflare',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'DE',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.routeStatus).toBe('UNSUPPORTED');
    expect(result.status.routeReasonCode).toBe('ASSET_DISABLED');
  });
});

describe('readSelectedPaymentStatus — purchaseValueUsdgRaw always present when requiredUsdgRaw given', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the USDG-equivalent value for ETH so the order summary can render the secondary line', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'eth',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'US',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.purchaseValueUsdgRaw).toBe('1430000000');
  });

  it('exposes the USDG-equivalent value for AAPL with the stock-token fee preserved', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'rh-aapl',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'DE',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status.purchaseValueUsdgRaw).toBe('1430000000');
    expect(result.status.serviceFeeBps).toBe(200);
    expect(result.status.serviceFeeRaw).toBeNull(); // no live quote → null
  });
});

describe('readSelectedPaymentStatus — input validation', () => {
  it('returns unknown_asset for an assetId not in the registry', async () => {
    const result = await readSelectedPaymentStatus({
      buyerAddress: BUYER,
      assetId: 'rh-not-a-real-token',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
      country: 'US',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('unknown_asset');
  });
});