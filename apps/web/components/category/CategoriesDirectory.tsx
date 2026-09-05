'use client';

import { useMemo, useState } from 'react';
import { Star } from '@phosphor-icons/react/dist/ssr';
import { CategoryRow } from '@/components/ui/CategoryRow';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CategoryMetrics } from '@/lib/market';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import { cn } from '@/lib/cn';

const FAMILIES = [
  { value: 'all', label: 'All' },
  { value: 'number', label: 'Number' },
  { value: 'material', label: 'Material' },
  { value: 'pattern', label: 'Pattern' },
  { value: 'culture', label: 'Culture' },
] as const;

type SortKey =
  | 'trending'
  | 'volume'
  | 'sales'
  | 'floorGain'
  | 'supply'
  | 'highestSale';

export function CategoriesDirectory({ categories }: { categories: CategoryMetrics[] }) {
  const [family, setFamily] = useState<(typeof FAMILIES)[number]['value']>('all');
  const [sort, setSort] = useState<SortKey>('trending');
  const [query, setQuery] = useState('');
  const { isWatchingCategory } = useWatchlist();
  const syncing = categories.some((c) => c.marketStatus === 'syncing');

  const rows = useMemo(() => {
    let next = categories.filter((c) => c.memberSupply > 0 || c.source === 'metadata');
    if (family !== 'all') next = next.filter((c) => c.family === family);
    if (query) {
      const q = query.toLowerCase();
      next = next.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q));
    }
    next = [...next].sort((a, b) => {
      if (sort === 'trending') return b.trendingScore - a.trendingScore;
      if (sort === 'volume') return b.volume24h - a.volume24h;
      if (sort === 'sales') return b.sales24h - a.sales24h;
      if (sort === 'floorGain') return (b.floorChange7d ?? -999) - (a.floorChange7d ?? -999);
      if (sort === 'supply') return a.memberSupply - b.memberSupply;
      return (b.highestSale?.price ?? 0) - (a.highestSale?.price ?? 0);
    });
    return next;
  }, [categories, family, sort, query]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">Categories</span>
          <LiveIndicator
            tone={syncing ? 'amber' : 'green'}
            size={6}
            label={syncing ? 'Syncing market data' : 'Live'}
          />
        </div>
        <h1 className="text-display text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--color-text-primary)]">
          Categories
        </h1>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          Explore the Button Presser market by number, material, and pattern. Material comes from
          official Plate metadata. Number and pattern are derived. Unknown listings are never shown
          as zero.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FAMILIES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFamily(item.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm',
              family === item.value
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm"
        >
          <option value="trending">Trending</option>
          <option value="volume">Highest volume</option>
          <option value="sales">Most sales</option>
          <option value="floorGain">Floor gain</option>
          <option value="supply">Lowest supply</option>
          <option value="highestSale">Highest sale</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories"
          className="h-10 min-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No categories match"
          body="Try another family filter or wait for the indexer to attach Plate metadata."
          tone="muted"
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]">
          <div className="hidden grid-cols-[2.25rem_minmax(0,1fr)_6rem_5rem_5rem_6rem_5rem_5rem_2.5rem] items-center gap-3 border-b border-[var(--color-border-subtle)] px-6 py-3 text-eyebrow-muted md:grid">
            <span />
            <span>Category</span>
            <span className="text-right">Floor</span>
            <span className="text-right">24h</span>
            <span className="text-right">7d</span>
            <span className="text-right">Vol 24h</span>
            <span className="text-right">Sales</span>
            <span className="text-right">Listed</span>
            <span />
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {rows.map((c) => (
              <div key={c.slug} className="relative">
                {isWatchingCategory(c.slug) ? (
                  <Star
                    size={12}
                    weight="fill"
                    className="absolute left-2 top-5 text-[var(--color-net-green)] md:left-3"
                  />
                ) : null}
                <CategoryRow metrics={c} movement={c.floorChange24h} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
