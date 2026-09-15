/**
 * Competing fill while this buyer was preparing or signing.
 * Never "Transaction failed." Never CONFIRMED.
 */
export const SOLD_DURING_CHECKOUT = 'SOLD_DURING_CHECKOUT' as const;
export const PREPARING_ELSEWHERE = 'PREPARING_ELSEWHERE' as const;

export const SOLD_DURING_CHECKOUT_COPY =
  'This NFT was purchased before your transaction completed. No purchase was made. Your funds remain in your wallet.';

export const PREPARING_ELSEWHERE_COPY =
  'Another purchase is currently being prepared. Rechecking availability…';

export class SoldDuringCheckoutError extends Error {
  readonly code = SOLD_DURING_CHECKOUT;
  constructor() {
    super(SOLD_DURING_CHECKOUT_COPY);
    this.name = 'SoldDuringCheckoutError';
  }
}

export class PreparingElsewhereError extends Error {
  readonly code = PREPARING_ELSEWHERE;
  readonly expiresAt: number;
  constructor(expiresAt: number) {
    super(PREPARING_ELSEWHERE_COPY);
    this.name = 'PreparingElsewhereError';
    this.expiresAt = expiresAt;
  }
}

export function isSoldDuringCheckout(err: unknown): boolean {
  if (err instanceof SoldDuringCheckoutError) return true;
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return (err as { code?: unknown }).code === SOLD_DURING_CHECKOUT;
  }
  if (err instanceof Error) {
    return (
      /listing gone \(sold\)/i.test(err.message) ||
      /no active listing/i.test(err.message) ||
      /purchased before your transaction/i.test(err.message)
    );
  }
  return false;
}
