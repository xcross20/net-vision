import { describe, expect, it } from 'vitest';
import { assertCanMarkConfirmed } from '@/lib/cart/checkout-machine';
import {
  assertHashIsSubmittedNotConfirmed,
  idempotencyKey,
  markConfirmed,
  markSubmitted,
  newPurchaseIntentId,
  replayOrReject,
  type PurchaseIntent,
} from './purchase-intent';
import { createMemoryPurchaseIntentStore } from './purchase-intent-store';
import { createMemoryListingLeaseStore } from './listing-lease';
import { createMemoryNativeFillLock } from './native-fill-lock';
import {
  PREPARING_ELSEWHERE_COPY,
  SOLD_DURING_CHECKOUT,
  SOLD_DURING_CHECKOUT_COPY,
  SoldDuringCheckoutError,
  isSoldDuringCheckout,
} from './sold-during-checkout';
import { createSingleFlight, mapPool } from './single-flight';
import { createWalletRateLimit } from './wallet-rate-limit';
import { checkoutFailureMessage } from '@/lib/wallet/network-errors';

function intent(over: Partial<PurchaseIntent> = {}): PurchaseIntent {
  return {
    id: 'pi_1',
    buyer: '0xabc',
    orderHash: '0xorder',
    collectionId: 'button-presser',
    tokenId: 4508,
    cartRevision: 3,
    state: 'PREPARING',
    txHash: null,
    receiptStatus: null,
    source: 'native',
    createdAt: 1,
    expiresAt: 20_000,
    ...over,
  };
}

describe('idempotency', () => {
  it('replays the same key instead of creating a second intent', () => {
    const store = createMemoryPurchaseIntentStore();
    const a = store.create({
      id: 'pi_1',
      buyer: '0xAbC',
      orderHash: '0xorder',
      collectionId: 'button-presser',
      tokenId: 4508,
      cartRevision: 3,
      source: 'opensea',
      now: 1000,
    });
    const b = store.create({
      id: 'pi_1',
      buyer: '0xabc',
      orderHash: '0xorder',
      collectionId: 'button-presser',
      tokenId: 4508,
      cartRevision: 3,
      source: 'opensea',
      now: 1001,
    });
    expect(b).toEqual(a);
    expect(store.replay({
      purchaseIntentId: 'pi_1',
      buyer: '0xABC',
      orderHash: '0xorder',
      cartRevision: 3,
    })?.id).toBe('pi_1');
  });

  it('rejects a replay that mutates buyer or order hash', () => {
    const existing = intent();
    const bad = replayOrReject(existing, {
      purchaseIntentId: 'pi_1',
      buyer: '0xabc',
      orderHash: '0xother',
      cartRevision: 3,
    });
    expect(bad.ok).toBe(false);
  });

  it('idempotency key is buyer-normalized', () => {
    expect(
      idempotencyKey({
        purchaseIntentId: 'pi',
        buyer: '0xABC',
        orderHash: '0xh',
        cartRevision: 1,
      }),
    ).toBe(
      idempotencyKey({
        purchaseIntentId: 'pi',
        buyer: '0xabc',
        orderHash: '0xh',
        cartRevision: 1,
      }),
    );
  });
});

describe('native FILL_PENDING', () => {
  it('lets exactly one of 50 concurrent claims win', () => {
    const lock = createMemoryNativeFillLock();
    lock.seed({
      orderHash: '0xnative',
      executionState: 'AVAILABLE',
      executionBuyer: null,
      executionExpiresAt: null,
      executionIntentId: null,
    });
    const results = Array.from({ length: 50 }, (_, i) =>
      lock.claim({
        orderHash: '0xnative',
        buyer: `0x${(i + 1).toString(16).padStart(40, '0')}`,
        intentId: `pi_${i}`,
        expiresAt: 20_000,
        now: 1000,
      }),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'HELD')).toHaveLength(49);
  });

  it('replays the same buyer+intent as the holder', () => {
    const lock = createMemoryNativeFillLock();
    lock.seed({
      orderHash: '0xnative',
      executionState: 'AVAILABLE',
      executionBuyer: null,
      executionExpiresAt: null,
      executionIntentId: null,
    });
    const first = lock.claim({
      orderHash: '0xnative',
      buyer: '0xabc',
      intentId: 'pi_1',
      expiresAt: 20_000,
      now: 1000,
    });
    const again = lock.claim({
      orderHash: '0xnative',
      buyer: '0xabc',
      intentId: 'pi_1',
      expiresAt: 20_000,
      now: 1001,
    });
    expect(first.ok).toBe(true);
    expect(again.ok).toBe(true);
  });

  it('releases FILL_PENDING after failed receipt so another buyer can claim', () => {
    const lock = createMemoryNativeFillLock();
    lock.seed({
      orderHash: '0xnative',
      executionState: 'AVAILABLE',
      executionBuyer: null,
      executionExpiresAt: null,
      executionIntentId: null,
    });
    lock.claim({
      orderHash: '0xnative',
      buyer: '0xaaa',
      intentId: 'pi_a',
      expiresAt: 20_000,
      now: 1000,
    });
    lock.release('0xnative', 'pi_a', 2000);
    const next = lock.claim({
      orderHash: '0xnative',
      buyer: '0xbbb',
      intentId: 'pi_b',
      expiresAt: 30_000,
      now: 2001,
    });
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.row.executionBuyer).toBe('0xbbb');
  });
});

describe('OpenSea UX lease is not on-chain exclusivity', () => {
  it('holds a short lease then expires', () => {
    const leases = createMemoryListingLeaseStore();
    const a = leases.acquire({
      orderHash: '0xos',
      buyer: '0xaaa',
      intentId: 'pi_a',
      now: 1000,
      ttlMs: 15_000,
    });
    const b = leases.acquire({
      orderHash: '0xos',
      buyer: '0xbbb',
      intentId: 'pi_b',
      now: 1001,
      ttlMs: 15_000,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe('HELD');
    const after = leases.acquire({
      orderHash: '0xos',
      buyer: '0xbbb',
      intentId: 'pi_b',
      now: 16_001,
      ttlMs: 15_000,
    });
    expect(after.ok).toBe(true);
  });
});

describe('confirmation', () => {
  it('tx hash is submitted, not confirmed', () => {
    const submitted = markSubmitted(intent(), '0xtx');
    expect(submitted.state).toBe('SUBMITTED');
    expect(submitted.receiptStatus).toBe('pending');
    expect(() => assertCanMarkConfirmed(submitted.receiptStatus)).toThrow(/receipt success/);
    expect(() =>
      assertHashIsSubmittedNotConfirmed({ ...submitted, state: 'CONFIRMED', receiptStatus: 'pending' }),
    ).toThrow(/SUBMITTED only/);
  });

  it('CONFIRMED requires receipt success', () => {
    expect(() => markConfirmed(markSubmitted(intent(), '0xtx'))).toThrow(/receipt success/);
    const ok = markConfirmed({
      ...markSubmitted(intent(), '0xtx'),
      receiptStatus: 'success',
    });
    expect(ok.state).toBe('CONFIRMED');
  });
});

describe('SOLD_DURING_CHECKOUT copy', () => {
  it('never says Transaction failed', () => {
    const err = new SoldDuringCheckoutError();
    expect(err.message).toBe(SOLD_DURING_CHECKOUT_COPY);
    expect(err.message.toLowerCase()).not.toContain('transaction failed');
    expect(isSoldDuringCheckout(err)).toBe(true);
    expect(isSoldDuringCheckout(new Error('Listing gone (sold)'))).toBe(true);
    expect(checkoutFailureMessage(err)).toBe(SOLD_DURING_CHECKOUT_COPY);
    expect(PREPARING_ELSEWHERE_COPY.toLowerCase()).not.toContain('reserved onchain');
    expect(SOLD_DURING_CHECKOUT).toBe('SOLD_DURING_CHECKOUT');
  });
});

describe('single-flight listing checks', () => {
  it('50 identical lookups share one upstream call', async () => {
    const flight = createSingleFlight<string>(1000);
    let calls = 0;
    const work = () => {
      calls += 1;
      return Promise.resolve('live');
    };
    const results = await Promise.all(
      Array.from({ length: 50 }, () => flight.do('token:966', work, 1)),
    );
    expect(calls).toBe(1);
    expect(new Set(results)).toEqual(new Set(['live']));
  });

  it('bounds concurrent workers', async () => {
    let live = 0;
    let peak = 0;
    await mapPool([1, 2, 3, 4, 5, 6], 2, async () => {
      live += 1;
      peak = Math.max(peak, live);
      await Promise.resolve();
      live -= 1;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('per-wallet prepare rate limit', () => {
  it('rejects the 6th prepare in the window without skipping safety', () => {
    const limit = createWalletRateLimit({ windowMs: 10_000, max: 5 });
    const buyer = '0xabc';
    for (let i = 0; i < 5; i += 1) expect(limit.allow(buyer, 1000 + i)).toBe(true);
    expect(limit.allow(buyer, 1005)).toBe(false);
    expect(limit.allow(buyer, 11_001)).toBe(true);
  });
});

describe('intent ids', () => {
  it('are unique enough for double-click keys', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newPurchaseIntentId()));
    expect(ids.size).toBe(50);
  });
});
