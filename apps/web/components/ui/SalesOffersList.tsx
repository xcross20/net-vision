import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { LiveIndicator } from './LiveIndicator';
import { address, payment, relative } from '@/lib/format';

/**
 * Compact, borderless list of recent sales or offers. Reads as a
 * rolling tape; each entry is a one-line readout of event, price, and
 * counterparty. Designed to sit below the live market grid on the
 * homepage.
 */
export function SalesOffersList({
  title,
  empty,
  entries,
  viewAllHref,
  type,
}: {
  title: string;
  empty: string;
  entries: SaleOrOfferEntry[];
  viewAllHref?: string;
  type: 'sale' | 'offer';
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-eyebrow-muted">{type === 'sale' ? 'Sales' : 'Offers'}</span>
          <h3 className="text-display text-xl text-[var(--color-text-primary)]">{title}</h3>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            View all
            <ArrowRight size={11} weight="bold" />
          </Link>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] px-5 py-10 text-center">
          <div className="flex flex-col items-center gap-2">
            <LiveIndicator tone="muted" size={6} label="No activity yet" />
            <p className="max-w-[42ch] text-sm text-[var(--color-text-secondary)]">{empty}</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
          {entries.map((e) => (
            <li key={`${e.tokenId}-${e.occurredAt}-${e.kind}`}>
              <Link
                href={`/tokens/${e.tokenId}`}
                className="group flex items-center gap-3 px-1 py-2.5 transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <span
                  className={`flex h-1.5 w-1.5 shrink-0 rounded-full ${e.kind === 'sale' ? 'bg-[var(--color-net-green)]' : 'bg-[var(--color-warning)]'}`}
                  aria-hidden="true"
                />
                <span className="text-numeral text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
                  #{e.tokenId}
                </span>
                <span className="text-numeral text-sm text-[var(--color-text-secondary)]">
                  {payment(e.price, e.currency)}
                </span>
                <span className="hidden truncate text-[11px] text-[var(--color-text-tertiary)] md:inline">
                  {e.kind === 'sale'
                    ? `${address(e.buyer)} bought from ${address(e.seller)}`
                    : `${address(e.maker)} offered`}
                </span>
                <span className="ml-auto text-numeral text-[11px] text-[var(--color-text-tertiary)]">
                  {relative(e.occurredAt)}
                </span>
                <ArrowUpRight
                  size={11}
                  weight="bold"
                  className="text-[var(--color-text-tertiary)] transition-colors group-hover:text-[var(--color-net-green)]"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type SaleOrOfferEntry = {
  kind: 'sale' | 'offer';
  tokenId: string;
  /** Numeric payment-currency price (e.g. USDG). */
  price: number;
  currency: string;
  /** epoch seconds, when the trade cleared or the offer last changed. */
  occurredAt: number;
  orderHash: string | null;
  /** Sale-only fields. */
  buyer?: string | null;
  seller?: string | null;
  /** Offer-only fields. */
  expiresAt?: number | null;
  maker?: string | null;
};
