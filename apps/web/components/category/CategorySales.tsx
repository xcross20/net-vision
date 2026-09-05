'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CategoryMetrics } from '@/lib/market';
import type { Sale } from '@/lib/market/source';
import { compact, payment, relative } from '@/lib/format';

const WINDOWS = ['24h', '7d', '30d', 'all'] as const;

export function CategorySales({
  slug,
  metrics,
}: {
  slug: string;
  metrics: CategoryMetrics;
}) {
  const [window, setWindow] = useState<(typeof WINDOWS)[number]>('all');
  const [sales, setSales] = useState<Sale[]>([]);
  const [top, setTop] = useState<Sale[]>([]);

  useEffect(() => {
    void fetch(`/api/categories/${encodeURIComponent(slug)}/sales?window=${window}`)
      .then((res) => res.json())
      .then((body: { sales?: Sale[] }) => setSales(body.sales ?? []))
      .catch(() => setSales([]));
    void fetch(`/api/categories/${encodeURIComponent(slug)}/top-sales`)
      .then((res) => res.json())
      .then((body: { sales?: Sale[] }) => setTop(body.sales ?? []))
      .catch(() => setTop([]));
  }, [slug, window]);

  const volume =
    window === '24h'
      ? metrics.volume24h
      : window === '7d'
        ? metrics.volume7d
        : window === '30d'
          ? metrics.volume30d
          : metrics.volumeAllTracked;
  const count =
    window === '24h'
      ? metrics.sales24h
      : window === '7d'
        ? metrics.sales7d
        : window === '30d'
          ? metrics.sales30d
          : sales.length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setWindow(value)}
            className={
              value === window
                ? 'rounded-full bg-[var(--color-surface-3)] px-3 py-1 text-xs'
                : 'rounded-full px-3 py-1 text-xs text-[var(--color-text-tertiary)]'
            }
          >
            {value === 'all' ? 'All tracked' : value.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Mini label="Volume" value={compact(volume)} />
        <Mini label="Sales" value={count.toLocaleString()} />
        <Mini label="Average" value={payment(metrics.averageSale, metrics.currency)} />
        <Mini label="Median" value={payment(metrics.medianSale, metrics.currency)} />
      </div>
      {metrics.highestSale ? (
        <Link
          href={`/tokens/${metrics.highestSale.tokenId}`}
          className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-5"
        >
          <span className="text-eyebrow-muted">Highest sale</span>
          <span className="text-numeral text-2xl text-[var(--color-net-green)]">
            {payment(metrics.highestSale.price, metrics.currency)}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)]">#{metrics.highestSale.tokenId}</span>
        </Link>
      ) : (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No tracked sales yet. History starts when the indexer records a fill.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <SaleTable title="Recent sales" sales={sales} currency={metrics.currency} />
        <SaleTable title="Top sales" sales={top} currency={metrics.currency} ranked />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow-muted">{label}</span>
      <span className="text-numeral text-xl font-semibold">{value}</span>
    </div>
  );
}

function SaleTable({
  title,
  sales,
  currency,
  ranked,
}: {
  title: string;
  sales: Sale[];
  currency: string;
  ranked?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-display text-xl">{title}</h3>
      {sales.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">No tracked sales in this window.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
          {sales.map((sale, index) => (
            <Link
              key={`${sale.orderHash ?? sale.tokenId}-${sale.occurredAt}`}
              href={`/tokens/${sale.tokenId}`}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <span className="text-[var(--color-text-tertiary)] w-6">
                {ranked ? index + 1 : ''}
              </span>
              <span className="flex-1">#{sale.tokenId}</span>
              <span className="text-numeral">{payment(sale.price, sale.currency || currency)}</span>
              <span className="w-16 text-right text-[var(--color-text-tertiary)]">
                {relative(sale.occurredAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
