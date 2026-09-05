import Link from 'next/link';
import { listCategories } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';
import type { CategoryMetrics } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { ArrowR, StarIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Categories — Net Vision',
  description: 'Every Button Presser category ranked by live floor.',
};

export default async function CategoriesPage() {
  const [categories, freshness] = await Promise.all([
    listCategories(),
    getMarketSource().getFreshness(),
  ]);

  const populated = categories.filter((c) => c.memberSupply > 0);
  const empty = categories.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="nv-eyebrow">Categories</span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="nv-display text-3xl md:text-5xl">Every algorithmic market</h1>
        <p className="nv-body">
          Categories are computed deterministically from each token&apos;s number. Floors and
          listing counts are live from the OpenSea orderbook.
        </p>
      </header>

      {empty ? (
        <div className="nv-panel-soft flex flex-col gap-3 p-6 md:p-8">
          <span className="text-base font-semibold tracking-tight text-[var(--nv-text)]">
            Live category floors are warming up
          </span>
          <p className="text-sm leading-relaxed text-[var(--nv-muted)]">
            The OpenSea indexer has not yet surfaced listing data for Button Presser. Pull in a
            few minutes, or browse the market directly.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--nv-radius-lg)] border border-[var(--nv-border)]">
          <div className="hidden border-b border-[var(--nv-border)] bg-[var(--nv-panel-soft)] px-4 py-2 md:block">
            <div className="grid grid-cols-12 gap-4 text-[10px] uppercase tracking-wider text-[var(--nv-muted)]">
              <div className="col-span-5">Category</div>
              <div className="col-span-2 text-right">Floor</div>
              <div className="col-span-1 text-right">Listed</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-2 text-right">Owners</div>
              <div className="col-span-1" />
            </div>
          </div>
          <div className="flex flex-col divide-y divide-[var(--nv-border)] bg-[var(--nv-bg)]">
            {populated.map((c) => (
              <CategoryRow key={c.slug} metrics={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ metrics }: { metrics: CategoryMetrics }) {
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className="group grid grid-cols-12 items-center gap-4 px-4 py-4 transition-colors hover:bg-[var(--nv-panel-elevated)]"
    >
      <div className="col-span-12 flex items-center gap-3 md:col-span-5">
        <StarIcon
          size={14}
          weight="duotone"
          className="text-[var(--nv-green)] transition-transform group-hover:scale-110"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold tracking-tight text-[var(--nv-text)]">
            {metrics.name}
          </span>
          <span className="truncate text-xs text-[var(--nv-muted)]">{metrics.description}</span>
        </div>
      </div>
      <div className="col-span-6 text-right text-sm nv-mono md:col-span-2">
        {formatPrice(metrics.floorPriceEth)}
      </div>
      <div className="col-span-3 text-right text-sm nv-mono md:col-span-1">
        {metrics.listedCount.toLocaleString()}
      </div>
      <div className="col-span-3 text-right text-sm nv-mono text-[var(--nv-muted)] md:col-span-1 md:text-[var(--nv-text)]">
        {metrics.memberSupply.toLocaleString()}
      </div>
      <div className="col-span-12 text-right text-sm nv-mono md:col-span-2">
        {metrics.owners.toLocaleString()}
      </div>
      <div className="col-span-12 hidden justify-end md:col-span-1 md:flex">
        <ArrowR
          size={14}
          weight="bold"
          className="text-[var(--nv-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--nv-green)]"
        />
      </div>
    </Link>
  );
}