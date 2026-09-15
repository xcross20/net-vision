/**
 * Exactly one Net Vision execution may own FILL_PENDING on a native order.
 */
export type NativeExecutionState = 'AVAILABLE' | 'FILL_PENDING' | 'FILLED';

export type NativeListingExecution = {
  orderHash: string;
  executionState: NativeExecutionState;
  executionBuyer: string | null;
  executionExpiresAt: number | null;
  executionIntentId: string | null;
};

export type ClaimResult =
  | { ok: true; row: NativeListingExecution }
  | { ok: false; reason: 'NOT_FOUND' | 'HELD' | 'FILLED' | 'EXPIRED_PENDING' };

export type NativeFillLock = {
  seed(row: NativeListingExecution): void;
  claim(input: {
    orderHash: string;
    buyer: string;
    intentId: string;
    expiresAt: number;
    now?: number;
  }): ClaimResult;
  fill(orderHash: string, intentId: string): ClaimResult;
  release(orderHash: string, intentId: string, now?: number): void;
  get(orderHash: string): NativeListingExecution | null;
};

export function createMemoryNativeFillLock(): NativeFillLock {
  const rows = new Map<string, NativeListingExecution>();

  return {
    seed(row) {
      rows.set(row.orderHash, { ...row });
    },
    get(orderHash) {
      return rows.get(orderHash) ?? null;
    },
    claim(input) {
      const now = input.now ?? Date.now();
      const current = rows.get(input.orderHash);
      if (!current) return { ok: false, reason: 'NOT_FOUND' };
      if (current.executionState === 'FILLED') return { ok: false, reason: 'FILLED' };
      if (current.executionState === 'FILL_PENDING') {
        if (
          current.executionBuyer === input.buyer.toLowerCase() &&
          current.executionIntentId === input.intentId
        ) {
          return { ok: true, row: current };
        }
        if (current.executionExpiresAt != null && current.executionExpiresAt <= now) {
          const next: NativeListingExecution = {
            orderHash: current.orderHash,
            executionState: 'FILL_PENDING',
            executionBuyer: input.buyer.toLowerCase(),
            executionExpiresAt: input.expiresAt,
            executionIntentId: input.intentId,
          };
          rows.set(input.orderHash, next);
          return { ok: true, row: next };
        }
        return { ok: false, reason: 'HELD' };
      }
      const next: NativeListingExecution = {
        orderHash: current.orderHash,
        executionState: 'FILL_PENDING',
        executionBuyer: input.buyer.toLowerCase(),
        executionExpiresAt: input.expiresAt,
        executionIntentId: input.intentId,
      };
      rows.set(input.orderHash, next);
      return { ok: true, row: next };
    },
    fill(orderHash, intentId) {
      const current = rows.get(orderHash);
      if (!current) return { ok: false, reason: 'NOT_FOUND' };
      if (current.executionIntentId !== intentId) return { ok: false, reason: 'HELD' };
      const next: NativeListingExecution = {
        ...current,
        executionState: 'FILLED',
      };
      rows.set(orderHash, next);
      return { ok: true, row: next };
    },
    release(orderHash, intentId, now) {
      const current = rows.get(orderHash);
      if (!current) return;
      if (current.executionIntentId !== intentId) return;
      if (current.executionState === 'FILLED') return;
      rows.set(orderHash, {
        orderHash,
        executionState: 'AVAILABLE',
        executionBuyer: null,
        executionExpiresAt: now ?? Date.now(),
        executionIntentId: null,
      });
    },
  };
}
