import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';

import {
  buildPaymentStatusRequest,
  useSelectedPaymentStatus,
} from './use-selected-payment-status';

const BUYER = '0x0000000000000000000000000000000000000abc' as Address;

describe('buildPaymentStatusRequest', () => {
  it('targets POST /api/payment/status with the buyer + assetId + cart fields', () => {
    const req = buildPaymentStatusRequest({
      buyer: BUYER,
      assetId: 'usdg',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: null,
    });
    expect(req.url).toBe('/api/payment/status');
    expect(req.init.method).toBe('POST');
    expect(req.init.headers['content-type']).toBe('application/json');
    const body = JSON.parse(req.init.body);
    expect(body.buyer).toBe(BUYER);
    expect(body.assetId).toBe('usdg');
    expect(body.requiredUsdgRaw).toBe('1430000000');
    expect(body.conduitKey).toBeNull();
  });

  it('passes requiredUsdgRaw=null through verbatim when the cart is empty', () => {
    const req = buildPaymentStatusRequest({
      buyer: BUYER,
      assetId: 'eth',
      requiredUsdgRaw: null,
      conduitKey: null,
    });
    const body = JSON.parse(req.init.body);
    expect(body.requiredUsdgRaw).toBeNull();
  });

  it('passes the conduitKey through for USDG settlement', () => {
    const req = buildPaymentStatusRequest({
      buyer: BUYER,
      assetId: 'usdg',
      requiredUsdgRaw: 1_430_000_000n,
      conduitKey: '0xabcdef',
    });
    const body = JSON.parse(req.init.body);
    expect(body.conduitKey).toBe('0xabcdef');
  });

  it('uses string-form of bigint (no JSON number truncation)', () => {
    // 18-decimal ETH value: 431_000_000_000_000_000n is well past Number.MAX_SAFE_INTEGER.
    const req = buildPaymentStatusRequest({
      buyer: BUYER,
      assetId: 'eth',
      requiredUsdgRaw: 431_000_000_000_000_000n,
      conduitKey: null,
    });
    const body = JSON.parse(req.init.body);
    expect(typeof body.requiredUsdgRaw).toBe('string');
    expect(body.requiredUsdgRaw).toBe('431000000000000000');
  });
});

describe('useSelectedPaymentStatus — exports', () => {
  // The hook itself requires a React renderer; we exercise its full
  // polling/cancel behaviour in apps/web/components/cart/CartCheckout.test.tsx
  // (commit 7). The pure request builder above is what commit 3 owns.
  it('exports a hook function with the expected shape', () => {
    expect(typeof useSelectedPaymentStatus).toBe('function');
  });
});
