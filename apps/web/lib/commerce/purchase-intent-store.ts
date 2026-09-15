/**
 * In-memory PurchaseIntent store. Postgres adapter uses the same API.
 * Same idempotency key never creates a second row.
 */
import {
  defaultIntentExpiry,
  idempotencyKey,
  normalizeBuyer,
  replayOrReject,
  type IdempotencyKey,
  type PurchaseIntent,
  type PurchaseIntentState,
  type PurchaseSource,
} from './purchase-intent';

export type CreateIntentInput = {
  id: string;
  buyer: string;
  orderHash: string;
  collectionId: string;
  tokenId: number;
  cartRevision: number;
  source: PurchaseSource;
  now?: number;
  expiresAt?: number;
};

export type PurchaseIntentStore = {
  get(id: string): PurchaseIntent | null;
  getByKey(key: IdempotencyKey): PurchaseIntent | null;
  create(input: CreateIntentInput): PurchaseIntent;
  replay(key: IdempotencyKey): PurchaseIntent | null;
  transition(id: string, state: PurchaseIntentState, patch?: Partial<PurchaseIntent>): PurchaseIntent;
};

export function createMemoryPurchaseIntentStore(): PurchaseIntentStore {
  const byId = new Map<string, PurchaseIntent>();
  const byKey = new Map<string, string>();

  return {
    get(id) {
      return byId.get(id) ?? null;
    },
    getByKey(key) {
      const id = byKey.get(idempotencyKey(key));
      return id ? byId.get(id) ?? null : null;
    },
    create(input) {
      const now = input.now ?? Date.now();
      const buyer = normalizeBuyer(input.buyer);
      const key: IdempotencyKey = {
        purchaseIntentId: input.id,
        buyer,
        orderHash: input.orderHash,
        cartRevision: input.cartRevision,
      };
      const existingId = byKey.get(idempotencyKey(key));
      if (existingId) {
        const existing = byId.get(existingId);
        if (existing) return existing;
      }
      const intent: PurchaseIntent = {
        id: input.id,
        buyer,
        orderHash: input.orderHash,
        collectionId: input.collectionId,
        tokenId: input.tokenId,
        cartRevision: input.cartRevision,
        state: 'PREPARING',
        txHash: null,
        receiptStatus: null,
        source: input.source,
        createdAt: now,
        expiresAt: input.expiresAt ?? defaultIntentExpiry(now),
      };
      byId.set(intent.id, intent);
      byKey.set(idempotencyKey(key), intent.id);
      return intent;
    },
    replay(key) {
      const existing = this.getByKey({
        ...key,
        buyer: normalizeBuyer(key.buyer),
      });
      if (!existing) return null;
      const check = replayOrReject(existing, {
        ...key,
        buyer: normalizeBuyer(key.buyer),
      });
      return check.ok ? check.intent : null;
    },
    transition(id, state, patch) {
      const current = byId.get(id);
      if (!current) throw new Error(`unknown purchase intent ${id}`);
      const next: PurchaseIntent = { ...current, ...patch, id: current.id, state };
      byId.set(id, next);
      return next;
    },
  };
}
