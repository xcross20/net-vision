/**
 * PurchaseIntent — one durable execution record per idempotency key.
 * Hash is SUBMITTED. CONFIRMED is receipt-only (assertCanMarkConfirmed).
 */
export const PURCHASE_INTENT_STATES = [
  'PREPARING',
  'PREPARED',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'SOLD',
  'EXPIRED',
] as const;

export type PurchaseIntentState = (typeof PURCHASE_INTENT_STATES)[number];
export type PurchaseSource = 'opensea' | 'native';

export type PurchaseIntent = {
  id: string;
  buyer: string;
  orderHash: string;
  collectionId: string;
  tokenId: number;
  cartRevision: number;
  state: PurchaseIntentState;
  txHash: string | null;
  receiptStatus: 'success' | 'reverted' | 'pending' | null;
  source: PurchaseSource;
  createdAt: number;
  expiresAt: number;
};

export type IdempotencyKey = {
  purchaseIntentId: string;
  buyer: string;
  orderHash: string;
  cartRevision: number;
};

export function normalizeBuyer(buyer: string): string {
  return buyer.toLowerCase();
}

export function idempotencyKey(input: IdempotencyKey): string {
  return `${input.purchaseIntentId}:${normalizeBuyer(input.buyer)}:${input.orderHash}:${input.cartRevision}`;
}

export function newPurchaseIntentId(now = Date.now()): string {
  return `pi_${now.toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
}

export const PREPARATION_LEASE_MS = 15_000;

export function defaultIntentExpiry(now = Date.now()): number {
  return now + PREPARATION_LEASE_MS;
}

const TERMINAL: ReadonlySet<PurchaseIntentState> = new Set([
  'CONFIRMED',
  'FAILED',
  'SOLD',
  'EXPIRED',
]);

export function isTerminalIntent(state: PurchaseIntentState): boolean {
  return TERMINAL.has(state);
}

/** Replay must return existing state, never spawn a second execution. */
export function replayOrReject(
  existing: PurchaseIntent,
  incoming: IdempotencyKey,
): { ok: true; intent: PurchaseIntent } | { ok: false; reason: 'KEY_MISMATCH' } {
  if (
    existing.id !== incoming.purchaseIntentId ||
    existing.buyer !== normalizeBuyer(incoming.buyer) ||
    existing.orderHash !== incoming.orderHash ||
    existing.cartRevision !== incoming.cartRevision
  ) {
    return { ok: false, reason: 'KEY_MISMATCH' };
  }
  return { ok: true, intent: existing };
}

export function assertHashIsSubmittedNotConfirmed(intent: PurchaseIntent): void {
  if (intent.txHash && intent.state === 'CONFIRMED' && intent.receiptStatus !== 'success') {
    throw new Error('CONFIRMED requires receipt success; tx hash is SUBMITTED only');
  }
}

export function markSubmitted(intent: PurchaseIntent, txHash: string): PurchaseIntent {
  if (isTerminalIntent(intent.state) && intent.state !== 'SUBMITTED') {
    throw new Error(`cannot submit from ${intent.state}`);
  }
  return { ...intent, state: 'SUBMITTED', txHash, receiptStatus: 'pending' };
}

export function markConfirmed(intent: PurchaseIntent): PurchaseIntent {
  if (intent.receiptStatus !== 'success') {
    throw new Error('cannot display CONFIRMED before receipt success');
  }
  return { ...intent, state: 'CONFIRMED' };
}
