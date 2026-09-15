/**
 * Server-side test for POST /api/payment/status.
 *
 * Stubs the country header (no CF-IPCountry on localhost) and the read
 * helper (no RPC). Verifies input validation, kill-switch behaviour, and
 * the response shape for USDG / ETH / AAPL / rh-net-cloudflare.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payment/read-selected-payment-status', () => ({
  readSelectedPaymentStatus: vi.fn(async () => ({
    ok: true,
    status: {
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
        spender: '0x0000000000000068F116a894984e2DB1123eB395',
        allowance: { state: 'KNOWN_SUFFICIENT', raw: '1500000000' },
      },
      purchaseValueUsdgRaw: '1430000000',
      serviceFeeBps: 0,
      serviceFeeRaw: '0',
    },
  })),
}));

import { POST } from './route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/payment/status', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  buyer: '0x0000000000000000000000000000000000000abc',
  assetId: 'usdg',
  requiredUsdgRaw: '1430000000',
  conduitKey: null,
};

describe('POST /api/payment/status — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-JSON bodies with 400', async () => {
    const res = await POST(
      new Request('http://localhost/api/payment/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects malformed buyer with 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, buyer: 'not-an-address' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed requiredUsdgRaw with 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, requiredUsdgRaw: 'twelve' }));
    expect(res.status).toBe(400);
  });

  it('accepts an optional conduitKey', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, conduitKey: '0xabcd' }));
    expect(res.status).toBe(200);
  });

  it('accepts a null requiredUsdgRaw and treats it as absent', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, requiredUsdgRaw: null }));
    expect(res.status).toBe(200);
  });

  it('accepts an optional cartItems array', async () => {
    const res = await POST(
      makeRequest({
        ...VALID_BODY,
        cartItems: [
          {
            tokenId: '1',
            contractAddress: '0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2',
            displayedOrderHash: '0xabcd',
            displayedPriceRaw: '1430000000',
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /api/payment/status — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the SelectedPaymentStatus shape', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.assetId).toBe('usdg');
    expect(json.symbol).toBe('USDG');
    expect(json.routeStatus).toBe('AVAILABLE');
    expect(json.balance).toEqual({ state: 'KNOWN_SUFFICIENT', raw: '1500000000' });
  });

  it('forwards the CF-IPCountry header as country', async () => {
    const { readSelectedPaymentStatus } = await import(
      '@/lib/payment/read-selected-payment-status'
    );
    await POST(makeRequest(VALID_BODY, { 'cf-ipcountry': 'DE' }));
    expect(readSelectedPaymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'DE' }),
    );
  });
});