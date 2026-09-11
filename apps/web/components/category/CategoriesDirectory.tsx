'use client';

import { useMemo, useState } from 'react';
import {
  Cube,
  Graph,
  Globe,
  Hash,
  MagnifyingGlass,
  SquaresFour,
  Star,
} from '@phosphor-icons/react/dist/ssr';
import { CategoryRow } from '@/components/ui/CategoryRow';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import type { CategoryMetrics } from '@/lib/market';
import { useLiveCategories } from '@/lib/market/use-live-metrics';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import { cn } from '@/lib/cn';

const FAMILIES = [
  { value: 'all', label: 'All Categories', Icon: SquaresFour },
  { value: 'number', label: 'Number', Icon: Hash },
  { value: 'material', label: 'Material', Icon: Cube },
  { value: 'pattern', label: 'Pattern', Icon: Graph },
  { value: 'culture', label: 'Culture', Icon: Globe },
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
  const live = useLiveCategories(categories, 10_000);
  const syncing = live.some((c) => c.marketStatus === 'syncing');

  const rows = useMemo(() => {
    let next = live.filter((c) => c.memberSupply > 0 || c.source === 'metadata');
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
  }, [live, family, sort, query]);

  return (
    <div className="flex flex-col gap-8">
      <CinematicHero
        imageSrc={SHOWROOM_MEDIA.categoriesHero}
        imageAlt="Cinematic brand atmosphere for the categories explorer"
        eyebrow="Categories explorer"
        title={
          <>
            Explore the <span className="text-[var(--color-net-green)]">possibilities.</span>
          </>
        }
        body="Browse number collections by type, material, pattern, and culture. Different categories. A bigger tomorrow."
        minHeightClass="min-h-[24rem] md:min-h-[28rem]"
        priority
        aside={
          <ShowroomAside lines={['Numbers', 'connect', 'worlds.']} />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {FAMILIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFamily(item.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                family === item.value
                  ? 'bg-[var(--color-net-green)] text-[var(--color-bg)]'
                  : 'nv-glass text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <item.Icon size={14} weight="duotone" />
              {item.label}
            </button>
          ))}
        </div>
      </CinematicHero>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-display text-xl text-[var(--color-text-primary)]">
            {rows.length} {rows.length === 1 ? 'category' : 'categories'}
          </h2>
          <LiveIndicator
            tone={syncing ? 'amber' : 'green'}
            size={6}
            label={syncing ? 'Syncing' : 'Live data'}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="nv-glass relative inline-flex min-w-[16rem] flex-1 items-center rounded-full px-3">
            <MagnifyingGlass size={14} className="text-[var(--color-text-tertiary)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories..."
              className="h-10 w-full bg-transparent px-2 text-sm outline-none"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 text-sm"
          >
            <option value="trending">Sort by: Trending</option>
            <option value="volume">Highest volume</option>
            <option value="sales">Most sales</option>
            <option value="floorGain">Floor gain</option>
            <option value="supply">Lowest supply</option>
            <option value="highestSale">Highest sale</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No categories match"
          body="Try another family filter or wait for the indexer to attach Plate metadata."
          tone="muted"
        />
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]">
          <div className="hidden grid-cols-[2.25rem_minmax(0,1.6fr)_5.5rem_6.5rem_5rem_5rem_6.5rem_5rem_5.5rem_5.5rem_2.5rem] items-center gap-3 border-b border-[var(--color-border-subtle)] px-6 py-3 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <span>#</span>
            <span>Category</span>
            <span>Type</span>
            <span className="text-right">Floor (USDG)</span>
            <span className="text-right">24h</span>
            <span className="text-right">7d</span>
            <span className="text-right">Volume (24h)</span>
            <span className="text-right">Sales (24h)</span>
            <span className="text-right">Listed</span>
            <span className="text-right">Items</span>
            <span />
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {rows.map((c, index) => (
              <div key={c.slug} className="relative">
                {isWatchingCategory(c.slug) ? (
                  <Star
                    size={12}
                    weight="fill"
                    className="absolute left-2 top-5 text-[var(--color-net-green)] md:left-3"
                  />
                ) : null}
                <CategoryRow metrics={c} index={index + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
