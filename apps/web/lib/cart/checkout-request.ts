/**
 * Bind async checkout reads to cart revision + wallet + chain.
 * A response started for revision N must not overwrite revision N+1.
 */
export type CheckoutRequestBind = {
  cartRevision: number;
  address: string | null;
  chainId: number | null;
};

export function checkoutRequestBind(input: {
  cartRevision: number;
  address?: string | null;
  chainId?: number | null;
}): CheckoutRequestBind {
  return {
    cartRevision: input.cartRevision,
    address: input.address ? input.address.toLowerCase() : null,
    chainId: input.chainId ?? null,
  };
}

export function isCheckoutResponseCurrent(
  bound: CheckoutRequestBind,
  live: CheckoutRequestBind,
): boolean {
  if (bound.cartRevision !== live.cartRevision) return false;
  if (bound.address !== live.address) return false;
  if (bound.chainId !== live.chainId) return false;
  return true;
}
