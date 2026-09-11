'use client';

import Link from 'next/link';
import { ArrowUR, CheckIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { payment } from '@/lib/format';
import type { CheckoutItem } from '@/lib/cart/types';

type Step = 1 | 2 | 3;

export function OrderSummary({
  step = 2,
  items,
  currency,
  subtotal,
  serviceFee,
  selectedAsset,
  ctaLabel,
  ctaOnClick,
  ctaDisabled = false,
  ctaNote,
  featureLine,
}: {
  step?: Step;
  items: CheckoutItem[];
  currency: string;
  subtotal: number;
  serviceFee: { bps: number; label: string };
  selectedAsset: 'USDG' | 'ETH' | 'NET' | string;
  ctaLabel: string;
  ctaOnClick: () => void;
  ctaDisabled?: boolean;
  ctaNote?: string;
  featureLine?: string;
}) {
  const feature = featureLine ?? defaultFeatureLine(selectedAsset, serviceFee.bps);
  const featured = items[0];
  return (
    <aside
      aria-label="Order summary"
      className="nv-glass-2 flex flex-col gap-4 rounded-[20px] p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-display text-xl text-[var(--color-text-primary)]">Order Summary</h3>
          <p className="text-[12px] text-[var(--color-text-secondary)]">
            Review your purchase details.
          </p>
        </div>
        <StepDots step={step} total={3} />
      </div>

      {featured ? <FeaturedItem item={featured} /> : null}

      <dl className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-3 text-[13px]">
        <Row label="Item price" value={payment(subtotal, currency)} />
        <Row
          label="Marketplace fee"
          value={serviceFee.bps === 0 ? '0.00 USDG' : serviceFee.label}
          suffix={
            <span
              aria-label="Service fee basis"
              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-tertiary)]"
            >
              i
            </span>
          }
        />
        <Row
          label="Total"
          value={payment(subtotal, currency)}
          emphasis
          secondary={approxUsd(subtotal)}
        />
      </dl>

      <div className="nv-glass-1 flex items-start gap-2 rounded-[14px] p-3 text-[12px] text-[var(--color-text-secondary)]">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-net-green)] text-[var(--color-net-green)]">
          <CheckIcon size={10} weight="bold" />
        </span>
        <span className="leading-relaxed">{feature}</span>
      </div>

      <button
        type="button"
        onClick={ctaOnClick}
        disabled={ctaDisabled}
        className={cn(
          'nv-button w-full justify-center text-[14px]',
          ctaDisabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {ctaLabel}
      </button>

      {ctaNote ? (
        <p className="text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">{ctaNote}</p>
      ) : null}
    </aside>
  );
}

function StepDots({ step, total }: { step: Step; total: 3 }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
        Step {step} of {total}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            aria-current={n === step ? 'step' : undefined}
            className={cn(
              'h-1.5 w-6 rounded-full transition-colors',
              n < step
                ? 'bg-[var(--color-net-green)]'
                : n === step
                  ? 'bg-[var(--color-net-green)]'
                  : 'bg-[rgba(72,235,145,0.18)]',
            )}
          />
        ))}
      </span>
    </div>
  );
}

function FeaturedItem({ item }: { item: CheckoutItem }) {
  const traits = item.cartItem.categories.slice(0, 3).map((c) => c.label);
  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.55)] p-3">
      <Link
        href={`/tokens/${item.cartItem.tokenId}`}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px]"
        aria-label={`Open Button Presser #${item.cartItem.tokenId}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.cartItem.imageUrl} alt="" className="h-full w-full object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-[var(--color-text-primary)]">
            Button Presser #{item.cartItem.tokenId}
          </span>
          <CheckIcon size={12} weight="bold" className="text-[var(--color-net-green)]" />
        </div>
        <span className="text-[11px] text-[var(--color-text-tertiary)]">
          NetNet Capital Management
        </span>
        <div className="flex flex-wrap gap-1">
          {traits.length > 0 ? (
            traits.map((label, idx) => (
              <span
                key={`${label}-${idx}`}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  idx === 0 && 'border border-[#5C99FF]/40 bg-[#5C99FF]/10 text-[#9CC0FF]',
                  idx === 1 && 'border border-[#E4A24C]/40 bg-[#E4A24C]/10 text-[#F0C68A]',
                  idx === 2 && 'border border-[var(--color-net-green)]/40 bg-[var(--color-net-green)]/10 text-[var(--color-net-green)]',
                )}
              >
                {label}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-[var(--color-net-green)]/40 bg-[var(--color-net-green)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-net-green)]">
              Verified
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-secondary)]">
          A genuine Button Presser from the original NetNet Capital Management collection.
        </p>
      </div>
      <Link
        href={`/tokens/${item.cartItem.tokenId}`}
        aria-label={`View Button Presser #${item.cartItem.tokenId}`}
        className="nv-icon-btn mt-1 inline-flex h-7 w-7 items-center justify-center"
      >
        <ArrowUR size={11} weight="bold" />
      </Link>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
  suffix,
  secondary,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  suffix?: React.ReactNode;
  secondary?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <dt className="text-[var(--color-text-secondary)]">{label}</dt>
        <dd
          className={cn(
            'flex items-center',
            emphasis
              ? 'text-numeral text-base font-semibold text-[var(--color-text-primary)]'
              : 'text-numeral text-[var(--color-text-primary)]',
          )}
        >
          {value}
          {suffix}
        </dd>
      </div>
      {secondary ? (
        <span className="self-end text-[10px] text-[var(--color-text-tertiary)]">{secondary}</span>
      ) : null}
    </div>
  );
}

function defaultFeatureLine(asset: string, feeBps: number): string {
  if (asset === 'USDG' || asset === 'ETH' || asset === 'NET' || feeBps === 0) {
    return 'No fees with crypto payments. Pay with USDG, ETH, or NET and avoid all marketplace fees.';
  }
  return 'Stock Token payments carry a 2% service fee with a $2 minimum. The fee covers conversion to USDG.';
}

function approxUsd(usdgValue: number): string {
  if (!Number.isFinite(usdgValue) || usdgValue <= 0) return '';
  return `≈ ${usdgValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD`;
}
