'use client';

import { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Cube,
  Graph,
  Globe,
  Hash,
  MagnifyingGlass,
  SquaresFour,
  Users,
} from '@phosphor-icons/react/dist/ssr';
import { CategoryRow } from '@/components/ui/CategoryRow';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { EmptyState } from '@/components/ui/EmptyState';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import type { CategoryMetrics, CollectionSnapshot } from '@/lib/market';
import { compact, payment } from '@/lib/format';
import { useLiveCategories } from '@/lib/market/use-live-metrics';
import { cn } from '@/lib/cn';

const FAMILIES = [
  { value: 'all', label: 'All Categories', Icon: SquaresFour },
  { value: 'number', label: 'Number', Icon: Hash },
  { value: 'material', label: 'Material', Icon: Cube },
  { value: 'pattern', label: 'Pattern', Icon: Graph },
  { value: 'culture', label: 'Culture', Icon: Globe },
] as const;

const WINDOWS = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'ALL' },
] as const;

type VolumeWindow = (typeof WINDOWS)[number]['value'];
type SortKey = 'trending' | 'volume' | 'sales' | 'floorGain' | 'supply' | 'highestSale';

export function CategoriesDirectory({
  categories,
  snapshot,
}: {
  categories: CategoryMetrics[];
  snapshot?: CollectionSnapshot | null;
}) {
  const [family, setFamily] = useState<(typeof FAMILIES)[number]['value']>('all');
  const [sort, setSort] = useState<SortKey>('volume');
  const [query, setQuery] = useState('');
  const [window, setWindow] = useState<VolumeWindow>('24h');
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
      if (sort === 'volume') return volumeFor(b, window) - volumeFor(a, window);
      if (sort === 'sales') return salesFor(b, window) - salesFor(a, window);
      if (sort === 'floorGain') return (b.floorChange7d ?? -999) - (a.floorChange7d ?? -999);
      if (sort === 'supply') return a.memberSupply - b.memberSupply;
      return (b.highestSale?.price ?? 0) - (a.highestSale?.price ?? 0);
    });
    return next;
  }, [live, family, sort, query, window]);

  return (
    <div className="flex flex-col gap-5">
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
        minHeightClass="min-h-[20rem] md:min-h-[24rem]"
        priority
        aside={<ShowroomAside lines={['Numbers', 'connect', 'worlds.']} />}
      >
        <div className="flex flex-wrap items-center gap-2">
          {FAMILIES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFamily(item.value)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium',
                family === item.value
                  ? 'bg-[var(--color-net-green)] text-[var(--color-bg)] shadow-[0_0_24px_rgba(72,235,145,0.28)]'
                  : 'nv-glass-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <item.Icon size={14} weight="duotone" />
              {item.label}
            </button>
          ))}
        </div>
      </CinematicHero>

      <div className="nv-glass-2 flex flex-col gap-3 rounded-[18px] p-3 lg:flex-row lg:items-center">
        <label className="nv-glass-1 flex min-w-0 flex-1 items-center gap-2 rounded-full px-4">
          <MagnifyingGlass size={14} className="text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories, e.g. brass, repeating..."
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="nv-glass-1 h-11 rounded-full px-4 text-sm"
        >
          <option value="volume">Sort by: Volume ({window})</option>
          <option value="trending">Trending</option>
          <option value="sales">Most sales</option>
          <option value="floorGain">Floor gain</option>
          <option value="supply">Lowest supply</option>
          <option value="highestSale">Highest sale</option>
        </select>
        <div className="nv-glass-1 inline-flex rounded-full p-1">
          {WINDOWS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setWindow(item.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-semibold',
                window === item.value
                  ? 'bg-[rgba(72,235,145,0.16)] text-[var(--color-net-green)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <LiveIndicator tone={syncing ? 'amber' : 'green'} size={6} label={syncing ? 'Syncing' : 'Live data'} />
        <span className="nv-icon-btn h-10 w-10" aria-hidden>
          <ArrowsClockwise size={15} />
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No categories match"
          body="Try another family filter or wait for the indexer to attach Plate metadata."
          tone="muted"
        />
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-[rgba(92,255,153,0.12)] bg-[color-mix(in_srgb,var(--color-surface-1)_80%,transparent)]">
          <div className="hidden grid-cols-[2.25rem_minmax(0,1.6fr)_5.5rem_6.5rem_5rem_5rem_6.5rem_5rem_5.5rem_5.5rem_6rem_2.5rem] items-center gap-3 border-b border-[var(--color-border-subtle)] px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)] lg:grid">
            <span>#</span>
            <span>Category</span>
            <span>Type</span>
            <span className="text-right">Floor (USDG)</span>
            <span className="text-right">24h</span>
            <span className="text-right">7d</span>
            <span className="text-right">Volume ({window})</span>
            <span className="text-right">Sales</span>
            <span className="text-right">Listed</span>
            <span className="text-right">Items</span>
            <span className="text-right">Trend (7d)</span>
            <span />
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {rows.map((c, index) => (
              <CategoryRow key={c.slug} metrics={c} index={index + 1} volumeWindow={window} />
            ))}
          </div>
        </div>
      )}

      <div className="nv-glass-2 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-3 text-[12px] text-[var(--color-text-secondary)]">
        <LiveIndicator tone={syncing ? 'amber' : 'green'} size={6} label="Market online" />
        <span className="nv-metric-card py-2">
          Total categories
          <strong className="text-numeral text-[var(--color-text-primary)]">{rows.length}</strong>
        </span>
        {snapshot ? (
          <>
            <span className="nv-metric-card py-2">
              <Cube size={14} className="text-[var(--color-net-green)]" />
              Total items
              <strong className="text-numeral text-[var(--color-text-primary)]">
                {snapshot.totalSupply.toLocaleString()}
              </strong>
            </span>
            <span className="nv-metric-card py-2">
              24h volume
              <strong className="text-numeral text-[var(--color-text-primary)]">
                {payment(snapshot.volume24hNative, 'ETH')}
              </strong>
            </span>
            <span className="nv-metric-card py-2">
              <Users size={14} className="text-[var(--color-net-green)]" />
              Owners
              <strong className="text-numeral text-[var(--color-text-primary)]">{compact(snapshot.owners)}</strong>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function volumeFor(metrics: CategoryMetrics, window: VolumeWindow): number {
  if (window === '7d') return metrics.volume7d;
  if (window === '30d') return metrics.volume30d;
  if (window === 'all') return metrics.volumeAllTracked;
  return metrics.volume24h;
}

function salesFor(metrics: CategoryMetrics, window: VolumeWindow): number {
  if (window === '7d' || window === '30d' || window === 'all') return metrics.sales7d;
  return metrics.sales24h;
}
