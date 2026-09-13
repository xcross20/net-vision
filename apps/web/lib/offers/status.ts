export const NATIVE_OFFER_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'FILLED',
  'CANCELLED',
  'EXPIRED',
  'INVALID',
] as const;

export type NativeOfferStatus = (typeof NATIVE_OFFER_STATUSES)[number];

export const OFFER_GROUP_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'PARTIALLY_FILLED',
  'FILLED',
  'CANCELLED',
  'EXPIRED',
] as const;

export type OfferGroupStatus = (typeof OFFER_GROUP_STATUSES)[number];

export function isFillableOfferStatus(status: NativeOfferStatus, nowSeconds: number, expiresAt: number): boolean {
  if (status !== 'ACTIVE') return false;
  return nowSeconds < expiresAt;
}

/** FILLED is only allowed after a successful receipt, never after wallet submit. */
export function assertCanMarkFilled(input: {
  status: NativeOfferStatus;
  receiptStatus: 'success' | 'reverted' | 'unknown';
}): void {
  if (input.receiptStatus !== 'success') {
    throw new Error('offer: cannot mark FILLED without a successful receipt');
  }
  if (input.status === 'CANCELLED') throw new Error('offer: cancelled offers cannot fill');
  if (input.status === 'EXPIRED') throw new Error('offer: expired offers cannot fill');
  if (input.status === 'FILLED') throw new Error('offer: already filled');
  if (input.status !== 'ACTIVE') throw new Error('offer: only ACTIVE offers can fill');
}

export function assertCanMarkCancelled(input: {
  status: NativeOfferStatus;
  cancelReceiptStatus: 'success' | 'reverted' | 'unknown';
}): void {
  if (input.cancelReceiptStatus !== 'success') {
    throw new Error('offer: cannot mark CANCELLED without a successful cancel receipt');
  }
  if (input.status === 'FILLED') throw new Error('offer: filled offers cannot cancel');
  if (input.status !== 'ACTIVE' && input.status !== 'DRAFT') {
    throw new Error('offer: only ACTIVE or DRAFT offers can cancel');
  }
}

export function deriveGroupStatus(members: NativeOfferStatus[]): OfferGroupStatus {
  if (members.length === 0) return 'DRAFT';
  const filled = members.filter((s) => s === 'FILLED').length;
  const active = members.filter((s) => s === 'ACTIVE').length;
  const cancelled = members.filter((s) => s === 'CANCELLED').length;
  if (filled === members.length) return 'FILLED';
  if (cancelled === members.length) return 'CANCELLED';
  if (filled > 0 && active > 0) return 'PARTIALLY_FILLED';
  if (active > 0) return 'ACTIVE';
  if (filled > 0) return 'PARTIALLY_FILLED';
  return 'EXPIRED';
}
