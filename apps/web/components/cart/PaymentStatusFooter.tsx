'use client';

import type { SelectedPaymentStatus } from '@/lib/payment/selected-payment-status';
import { formatSelectedAmount } from '@/lib/payment/checkout-cta';

/**
 * Renders the balance / allowance / required lines for the SELECTED asset
 * only — never for a different asset. The footer is hidden when
 * routeStatus !== 'AVAILABLE' because there is no authoritative
 * balance/allowance to report for an unexecutable route (that would
 * violate the Selected-Payment Invariant).
 *
 * See docs/launch/CHECKOUT_PAYMENT_STATE.md §5.1.
 */
export function PaymentStatusFooter({
  status,
}: {
  status: SelectedPaymentStatus;
}) {
  const allowance = status.allowance;
  const allowanceRequired = allowance.kind === 'REQUIRED';
  const insufficient = status.balance.state === 'KNOWN_INSUFFICIENT';
  const requiredRaw = status.requiredInputRaw;

  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.5)] p-3 text-[11px] text-[var(--color-text-tertiary)]">
      <p>
        Listings are rechecked against OpenSea before checkout. Prices and availability may have
        changed since you added items.
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span>
          {status.symbol} balance:{' '}
          <span className="text-numeral text-[var(--color-text-secondary)]">
            {formatAmount(status.balance.state, status.balance.raw, status.decimals, status.symbol)}
          </span>
        </span>
        {allowanceRequired ? (
          <span>
            Allowance:{' '}
            <span className="text-numeral text-[var(--color-text-secondary)]">
              {formatAmount(
                allowance.allowance.state,
                allowance.allowance.raw,
                status.decimals,
                status.symbol,
              )}
            </span>
          </span>
        ) : (
          <span>
            Allowance:{' '}
            <span className="text-numeral text-[var(--color-text-tertiary)]">
              not required
            </span>
          </span>
        )}
        <span>
          Required:{' '}
          <span className="text-numeral text-[var(--color-text-primary)]">
            {formatSelectedAmount(requiredRaw, status.decimals, status.symbol)}
          </span>
        </span>
      </div>
      {insufficient ? (
        <p className="text-[var(--color-warning)]">
          Insufficient {status.symbol}. Add funds — this checkout will continue automatically when
          the {status.symbol} balance covers{' '}
          {formatSelectedAmount(requiredRaw, status.decimals, status.symbol)}.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Render a balance/allowance amount as the selected asset's display
 * value, falling back to "unknown" when the chain read has not resolved.
 * Unknown is NEVER coerced to 0 — that was the original bug.
 */
function formatAmount(
  state: 'UNKNOWN' | 'KNOWN_SUFFICIENT' | 'KNOWN_INSUFFICIENT',
  raw: string | null,
  decimals: number,
  symbol: string,
): string {
  if (state === 'UNKNOWN') return 'unknown';
  return formatSelectedAmount(raw, decimals, symbol);
}
