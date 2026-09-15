/**
 * Short-lived UX lease on an order hash. Not on-chain exclusivity.
 * Another Net Vision prepare waits; OpenSea/Seaport can still fill.
 */
import { PREPARATION_LEASE_MS, normalizeBuyer } from './purchase-intent';

export type ListingLease = {
  orderHash: string;
  buyer: string;
  intentId: string;
  expiresAt: number;
};

export type LeaseResult =
  | { ok: true; lease: ListingLease; replay: boolean }
  | { ok: false; reason: 'HELD'; holder: string; expiresAt: number };

export type ListingLeaseStore = {
  acquire(input: {
    orderHash: string;
    buyer: string;
    intentId: string;
    now?: number;
    ttlMs?: number;
  }): LeaseResult;
  release(orderHash: string, intentId: string, now?: number): void;
  get(orderHash: string, now?: number): ListingLease | null;
};

export function createMemoryListingLeaseStore(): ListingLeaseStore {
  const leases = new Map<string, ListingLease>();

  function live(orderHash: string, now: number): ListingLease | null {
    const row = leases.get(orderHash);
    if (!row) return null;
    if (row.expiresAt <= now) {
      leases.delete(orderHash);
      return null;
    }
    return row;
  }

  return {
    acquire(input) {
      const now = input.now ?? Date.now();
      const ttl = input.ttlMs ?? PREPARATION_LEASE_MS;
      const buyer = normalizeBuyer(input.buyer);
      const current = live(input.orderHash, now);
      if (current) {
        if (current.buyer === buyer && current.intentId === input.intentId) {
          return { ok: true, lease: current, replay: true };
        }
        return { ok: false, reason: 'HELD', holder: current.buyer, expiresAt: current.expiresAt };
      }
      const lease: ListingLease = {
        orderHash: input.orderHash,
        buyer,
        intentId: input.intentId,
        expiresAt: now + ttl,
      };
      leases.set(input.orderHash, lease);
      return { ok: true, lease, replay: false };
    },
    release(orderHash, intentId, now) {
      const current = live(orderHash, now ?? Date.now());
      if (current && current.intentId === intentId) leases.delete(orderHash);
    },
    get(orderHash, now) {
      return live(orderHash, now ?? Date.now());
    },
  };
}
