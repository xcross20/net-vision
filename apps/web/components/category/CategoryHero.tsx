'use client';

import Link from 'next/link';
import { Star } from '@phosphor-icons/react/dist/ssr';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import type { CategoryMetrics } from '@/lib/market';

const FAMILY_LABEL: Record<string, string> = {
  number: 'Number',
  material: 'Material',
  pattern: 'Pattern',
  culture: 'Culture',
};

export function CategoryHero({ metrics }: { metrics: CategoryMetrics }) {
  const { isWatchingCategory, toggleCategory } = useWatchlist();
  const watching = isWatchingCategory(metrics.slug);
  const isSyncing = metrics.marketStatus === 'syncing';
  return (
    <header className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link href="/categories" className="transition-colors hover:text-[var(--color-text-primary)]">
          Categories
        </Link>
        <span>/</span>
        <span className="uppercase tracking-[0.16em] text-[11px]">
          {FAMILY_LABEL[metrics.family] ?? metrics.family}
        </span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-eyebrow">{FAMILY_LABEL[metrics.family] ?? metrics.family}</span>
            <LiveIndicator
              tone={isSyncing ? 'amber' : 'green'}
              size={6}
              label={isSyncing ? 'Syncing market data' : 'Live'}
            />
          </div>
          <h1 className="text-display text-[clamp(2.5rem,5.5vw,4.25rem)] text-[var(--color-text-primary)]">
            {metrics.name}
          </h1>
          <p className="text-body max-w-[58ch] text-[var(--color-text-secondary)] md:text-[17px]">
            {metrics.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleCategory(metrics.slug)}
          className="nv-button nv-button-ghost"
          aria-pressed={watching}
        >
          <Star size={14} weight={watching ? 'fill' : 'regular'} />
          {watching ? 'Watching' : 'Watch'}
        </button>
      </div>
    </header>
  );
}
