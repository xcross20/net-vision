import Link from 'next/link';
import { listCategories } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';
import type { CategoryMetrics } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[var(--nv-green)] text-xs uppercase tracking-[0.18em]">
            Categories
          </span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold">Every algorithmic market</h1>
        <p className="text-[var(--nv-muted)] max-w-2xl">
          Categories are computed deterministically from the token number. Floors and listings
          are live from the OpenSea orderbook.
        </p>
      </header>

      <div className="hidden md:grid grid-cols-12 gap-4 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--nv-muted)] border-y border-[var(--nv-border)]">
        <div className="col-span-1" />
        <div className="col-span-5">Category</div>
        <div className="col-span-2 text-right">Floor</div>
        <div className="col-span-1 text-right">Listed</div>
        <div className="col-span-1 text-right">Total</div>
        <div className="col-span-2 text-right">Owners</div>
      </div>

      <div className="flex flex-col">
        {categories.length === 0 ? (
          <div className="nv-panel p-6 text-sm text-[var(--nv-muted)]">
            Live category floors are unavailable while the OpenSea indexer warms up.
          </div>
        ) : (
          categories.map((c) => (
            <CategoryRow key={c.slug} metrics={c} />
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  metrics,
}: {
  metrics: CategoryMetrics;
}) {
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className="grid grid-cols-12 gap-4 items-center px-3 py-4 border-b border-[var(--nv-border)] hover:bg-[var(--nv-panel-elevated)] transition-colors"
    >
      <div className="col-span-1 text-[var(--nv-muted)]">★</div>
      <div className="col-span-5">
        <div className="font-medium">{metrics.name}</div>
        <div className="text-xs text-[var(--nv-muted)] line-clamp-1">{metrics.description}</div>
      </div>
      <div className="col-span-2 text-right text-sm nv-mono">
        {formatPrice(metrics.floorPriceEth)}
      </div>
      <div className="col-span-1 text-right text-sm nv-mono">
        {metrics.listedCount.toLocaleString()}
      </div>
      <div className="col-span-1 text-right text-sm nv-mono">
        {metrics.memberSupply.toLocaleString()}
      </div>
      <div className="col-span-2 text-right text-sm nv-mono">
        {metrics.owners.toLocaleString()}
      </div>
    </Link>
  );
}
