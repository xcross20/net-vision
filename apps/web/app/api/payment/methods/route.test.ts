/**
 * Server-side test for GET /api/payment/methods.
 *
 * Verifies the response includes the UI-level routeStatus per method
 * (the field the checkout picker reads to decide whether a tile is
 * disabled per the Selected-Payment Invariant, §5.2).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@net-vision/payment-router', () => ({
  listPaymentMethods: vi.fn(),
  countryFromHeaders: vi.fn(),
}));

// Stub routeStatusFromPolicy so the route module loads without dragging
// in the server-only readUsdgStatus chain (viem / RPC client).
vi.mock('@/lib/payment/read-selected-payment-status', () => ({
  routeStatusFromPolicy: vi.fn((policy: { jurisdiction: string; reasonCode?: string; routeStatus: string }) => {
    if (policy.jurisdiction !== 'ALLOWED') return 'REGION_RESTRICTED';
    if (policy.reasonCode === 'ASSET_DISABLED') return 'UNSUPPORTED';
    if (policy.routeStatus === 'AVAILABLE') return 'AVAILABLE';
    return 'COMING_SOON';
  }),
}));

import * as router from '@net-vision/payment-router';
import * as statusMapper from '@/lib/payment/read-selected-payment-status';

import { GET } from './route';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/payment/methods', {
    method: 'GET',
    headers,
  });
}

const USDG_AVAILABLE = {
  assetId: 'usdg',
  available: true,
  feeBps: 0,
  jurisdiction: 'ALLOWED',
  routeStatus: 'AVAILABLE',
  policyVersion: 'payment-policy-v3',
} as const;

const ETH_COMING_SOON = {
  assetId: 'eth',
  available: true,
  feeBps: 0,
  jurisdiction: 'ALLOWED',
  routeStatus: 'UNAVAILABLE',
  policyVersion: 'payment-policy-v3',
} as const;

const AAPL_REGION_RESTRICTED = {
  assetId: 'rh-aapl',
  available: false,
  feeBps: 200,
  jurisdiction: 'BLOCKED',
  routeStatus: 'UNAVAILABLE',
  reasonCode: 'REGION_RESTRICTED',
  policyVersion: 'payment-policy-v3',
} as const;

const AAPL_DE_COMING_SOON = {
  assetId: 'rh-aapl',
  available: true,
  feeBps: 200,
  jurisdiction: 'ALLOWED',
  routeStatus: 'UNAVAILABLE',
  policyVersion: 'payment-policy-v3',
} as const;

const CLOUDFLARE_DISABLED = {
  assetId: 'rh-net-cloudflare',
  available: false,
  feeBps: 200,
  jurisdiction: 'ALLOWED',
  routeStatus: 'UNAVAILABLE',
  reasonCode: 'ASSET_DISABLED',
  policyVersion: 'payment-policy-v3',
} as const;

describe('GET /api/payment/methods — routeStatus enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(router.countryFromHeaders).mockReturnValue('US');
  });

  it('returns the UI-level routeStatus per method so the picker can disable tiles', async () => {
    vi.mocked(router.listPaymentMethods).mockReturnValue([
      USDG_AVAILABLE,
      ETH_COMING_SOON,
      AAPL_REGION_RESTRICTED,
      CLOUDFLARE_DISABLED,
    ]);
    vi.mocked(statusMapper.routeStatusFromPolicy).mockImplementation(
      (policy: { jurisdiction: string; reasonCode?: string; routeStatus: string }) => {
        if (policy.jurisdiction !== 'ALLOWED') return 'REGION_RESTRICTED';
        if (policy.reasonCode === 'ASSET_DISABLED') return 'UNSUPPORTED';
        if (policy.routeStatus === 'AVAILABLE') return 'AVAILABLE';
        return 'COMING_SOON';
      },
    );

    const res = await GET(makeRequest());
    const json = (await res.json()) as {
      country: string | null;
      policyVersion: string | null;
      methods: Array<{
        assetId: string;
        routeStatus: string;
        routeReasonCode: string | null;
        routeNote: string | null;
      }>;
    };

    expect(json.country).toBe('US');
    expect(json.policyVersion).toBe('payment-policy-v3');
    const byAsset = new Map(json.methods.map((m) => [m.assetId, m]));
    expect(byAsset.get('usdg')?.routeStatus).toBe('AVAILABLE');
    expect(byAsset.get('eth')?.routeStatus).toBe('COMING_SOON');
    expect(byAsset.get('rh-aapl')?.routeStatus).toBe('REGION_RESTRICTED');
    expect(byAsset.get('rh-aapl')?.routeReasonCode).toBe('REGION_RESTRICTED');
    expect(byAsset.get('rh-net-cloudflare')?.routeStatus).toBe('UNSUPPORTED');
    expect(byAsset.get('rh-net-cloudflare')?.routeReasonCode).toBe('ASSET_DISABLED');
  });

  it('maps AAPL in DE to COMING_SOON (jurisdiction allowed but no route)', async () => {
    vi.mocked(router.countryFromHeaders).mockReturnValue('DE');
    vi.mocked(router.listPaymentMethods).mockReturnValue([
      USDG_AVAILABLE,
      ETH_COMING_SOON,
      AAPL_DE_COMING_SOON,
    ]);

    const res = await GET(makeRequest());
    const json = (await res.json()) as {
      methods: Array<{ assetId: string; routeStatus: string }>;
    };
    const aapl = json.methods.find((m) => m.assetId === 'rh-aapl');
    expect(aapl?.routeStatus).toBe('COMING_SOON');
  });

  it('forwards a null country when CF-IPCountry is absent', async () => {
    vi.mocked(router.countryFromHeaders).mockReturnValue(null);
    vi.mocked(router.listPaymentMethods).mockReturnValue([USDG_AVAILABLE]);

    const res = await GET(makeRequest());
    const json = (await res.json()) as { country: string | null };
    expect(json.country).toBeNull();
  });
});
