/**
 * Server-side test for the deprecated GET /api/trade/usdg-status.
 *
 * Verifies that every response carries `Deprecation: true` and a `Sunset`
 * header so callers and proxies can surface the migration to
 * POST /api/payment/status. Removal is scheduled for the release after
 * the staging→main PR that ships commit 5.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { GET } from './route';

function makeRequest(query: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/trade/usdg-status');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new Request(url.toString(), { method: 'GET' });
}

const BUYER = '0x0000000000000000000000000000000000000abc';

describe('GET /api/trade/usdg-status — deprecation headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches Deprecation + Sunset headers on the success response', async () => {
    const res = await GET(makeRequest({ buyer: BUYER }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('next-release');
  });

  it('attaches Deprecation + Sunset headers even on the 400 validation path', async () => {
    const res = await GET(makeRequest({ buyer: 'not-an-address' }));
    expect(res.status).toBe(400);
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBe('next-release');
  });

  it('still returns the existing USDG status shape (not removed yet)', async () => {
    const res = await GET(
      makeRequest({ buyer: BUYER, requiredRaw: '1430000000', conduitKey: '' }),
    );
    const json = (await res.json()) as { token: { symbol: string }; balance: { state: string } };
    expect(json.token.symbol).toBe('USDG');
    expect(json.balance.state).toBe('KNOWN_SUFFICIENT');
  });
});
