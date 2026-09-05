import Link from 'next/link';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { CategoryRow } from '@/components/ui/CategoryRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { listCategories } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';

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
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">Categories</span>
          <LiveIndicator
            tone={freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={freshness.fresh ? 'Live' : 'Warming'}
          />
        </div>
        <h1 className="text-display text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--color-text-primary)]">
          Every algorithmic market
        </h1>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          Categories are computed deterministically from each token&apos;s number. Floors,
          listing counts, and owner counts come straight from the live OpenSea orderbook.
        </p>
      </header>

      {empty ? (
        <EmptyState
          title="Live category floors are warming up"
          body="The OpenSea indexer has not yet surfaced listing data for Button Presser. Pull in a few minutes, or browse the market directly."
          tone="warming"
          action={
            <Link href="/market" className="nv-button nv-button-ghost">
              Open the market
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]">
          <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_6rem_4rem_5rem_6rem_5rem_2.5rem] items-center gap-3 border-b border-[var(--color-border-subtle)] px-6 py-3 text-eyebrow-muted md:grid">
            <span />
            <span>Category</span>
            <span className="text-right">Floor</span>
            <span className="text-right">Listed</span>
            <span className="text-right">Owners</span>
            <span className="text-right">Vol 24h</span>
            <span className="text-right">7d</span>
            <span className="text-right" />
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {populated.map((c) => (
              <CategoryRow key={c.slug} metrics={c} movement={null} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
