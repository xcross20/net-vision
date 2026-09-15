/**
 * Checkout CTA — a single pure function of SelectedPaymentStatus.
 *
 * Replaces the parallel `primaryCheckoutAction(...)` + ad-hoc `ctaLabel`
 * ternary chain in CartCheckout.tsx. Every payment-specific CTA in checkout
 * (balance display, allowance display, required amount, fee display, the
 * approve/insufficient/continue labels) is derived from this single shape.
 *
 * See docs/launch/CHECKOUT_PAYMENT_STATE.md for the Selected-Payment
 * Invariant and the full cartesian matrix of test cases.
 */
import type { SelectedPaymentStatus } from './selected-payment-status';

export type CheckoutCta =
  | { kind: 'continue'; label: 'Continue to Review' }
  | { kind: 'approve'; label: string }
  | { kind: 'insufficient'; label: string }
  | { kind: 'route_unavailable'; label: string }
  | { kind: 'wallet_required'; label: 'Connect wallet' }
  | { kind: 'switch_network'; label: 'Switch to Robinhood Chain' }
  | { kind: 'review_required'; label: string };

export type DeriveCheckoutCtaInput = {
  selected: SelectedPaymentStatus | null;
  isConnected: boolean;
  onRobinhood: boolean;
  cartItemCount: number;
  canBuy: boolean;
};

/**
 * Convert a raw bigint (string-encoded) in the asset's decimals to a
 * compact, human-friendly display value. Returns null when the input is
 * not a valid integer in range.
 *
 * This deliberately does NOT format with thousands separators — checkout
 * amounts are typically small enough (single digit or fractional) that
 * separators add noise.
 */
export function formatAssetAmount(
  raw: string | null,
  decimals: number,
): number | null {
  if (raw === null) return null;
  try {
    const big = BigInt(raw);
    if (big < 0n) return null;
    // Reject values that cannot be represented without loss beyond decimals.
    const denom = 10n ** BigInt(decimals);
    const whole = Number(big / denom);
    const frac = Number(big % denom) / Number(denom);
    const value = whole + frac;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Round-trip display helper: bigint raw → display string with the symbol
 * appended. Mirrors apps/web/lib/format.ts#payment() but starts from a
 * bigint string so the selected-asset invariant never loses precision.
 */
export function formatSelectedAmount(
  raw: string | null,
  decimals: number,
  symbol: string,
): string {
  const value = formatAssetAmount(raw, decimals);
  if (value === null) return `0 ${symbol}`;
  if (value === 0) return `0 ${symbol}`;
  if (Math.abs(value) < 0.001) return `${value.toExponential(2)} ${symbol}`;
  if (Math.abs(value) < 1) return `${value.toFixed(4)} ${symbol}`;
  if (Math.abs(value) < 1000) return `${value.toFixed(3)} ${symbol}`;
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${symbol}`;
}

/**
 * Compute the checkout CTA from selected-payment status.
 *
 * Order of precedence (do NOT reorder — each tier short-circuits):
 *
 *  1. Wallet/network gates (Connect wallet, Switch network) — only ever
 *     returnable when the wallet state would block ANY downstream action.
 *  2. Cart gates (Review N items, Nothing to buy) — returnable when the
 *     cart itself is not ready for checkout, regardless of payment state.
 *  3. Route gates (route_unavailable) — returnable whenever the selected
 *     asset has no executable settlement route, REGARDLESS of balance or
 *     allowance. The CTA MUST NOT report "Insufficient X" when X is
 *     marked COMING_SOON — there is no authoritative required-X amount.
 *  4. Balance gates (insufficient) — returnable only when the route IS
 *     available AND the wallet's balance for the SELECTED asset is known
 *     to be below the required input.
 *  5. Allowance gates (approve) — returnable when the route IS available,
 *     balance is sufficient, and the wallet's allowance for the SELECTED
 *     asset is known to be below the required input.
 *  6. Continue — returnable when all of the above are clear.
 */
export function deriveCheckoutCta(input: DeriveCheckoutCtaInput): CheckoutCta {
  // Tier 1: wallet gates
  if (!input.isConnected) {
    return { kind: 'wallet_required', label: 'Connect wallet' };
  }
  if (!input.onRobinhood) {
    return { kind: 'switch_network', label: 'Switch to Robinhood Chain' };
  }

  // Tier 2: cart gates
  if (input.cartItemCount === 0) {
    return { kind: 'review_required', label: 'Cart is empty' };
  }
  if (!input.canBuy) {
    return {
      kind: 'review_required',
      label: `Review ${input.cartItemCount} item${input.cartItemCount === 1 ? '' : 's'}`,
    };
  }

  // Tier 3: payment selection gate
  const selected = input.selected;
  if (selected === null) {
    return { kind: 'review_required', label: 'Choose payment method' };
  }

  // Tier 4: route gates (USDG may not leak; routeStatus MUST be checked first)
  if (selected.routeStatus === 'COMING_SOON') {
    return {
      kind: 'route_unavailable',
      label: `${selected.symbol} payments not available yet`,
    };
  }
  if (selected.routeStatus === 'REGION_RESTRICTED') {
    const isStock = selected.symbol !== 'USDG' && selected.symbol !== 'ETH' && selected.symbol !== 'NET';
    return {
      kind: 'route_unavailable',
      label: isStock
        ? 'Stock payments not available in your region'
        : `${selected.symbol} payments not available in your region`,
    };
  }
  if (selected.routeStatus === 'UNSUPPORTED') {
    return {
      kind: 'route_unavailable',
      label: `${selected.symbol} payments not available yet`,
    };
  }

  // Tier 5: balance gate (selected-asset balance, never USDG)
  if (selected.balance.state === 'KNOWN_INSUFFICIENT') {
    return {
      kind: 'insufficient',
      label: `Insufficient ${selected.symbol}`,
    };
  }
  if (selected.balance.state === 'UNKNOWN') {
    return {
      kind: 'route_unavailable',
      label: `${selected.symbol} balance unknown — try again`,
    };
  }

  // Tier 6: allowance gate
  if (selected.allowance.kind === 'REQUIRED') {
    if (selected.allowance.allowance.state === 'KNOWN_INSUFFICIENT') {
      const amountLabel = formatSelectedAmount(
        selected.requiredInputRaw,
        selected.decimals,
        selected.symbol,
      );
      // If we have no authoritative required amount, fall back to a
      // generic approve label rather than fabricating one.
      if (selected.requiredInputRaw === null) {
        return { kind: 'approve', label: `Approve ${selected.symbol}` };
      }
      return { kind: 'approve', label: `Approve ${amountLabel}` };
    }
    if (selected.allowance.allowance.state === 'UNKNOWN') {
      return {
        kind: 'route_unavailable',
        label: `${selected.symbol} allowance unresolved`,
      };
    }
    // spender must be present when allowance is REQUIRED + KNOWN_SUFFICIENT
    if (selected.allowance.spender === null) {
      return {
        kind: 'route_unavailable',
        label: `${selected.symbol} spender unresolved`,
      };
    }
  }

  // Tier 7: continue
  return { kind: 'continue', label: 'Continue to Review' };
}