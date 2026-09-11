'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Star } from '@phosphor-icons/react/dist/ssr';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import type { CategoryMetrics, Token } from '@/lib/market';
import { isProxyImageUrl } from '@/lib/data/media';

const FAMILY_LABEL: Record<string, string> = {
  number: 'Number',
  material: 'Material',
  pattern: 'Pattern',
  culture: 'Culture',
};

export function CategoryHero({
  metrics,
  heroToken,
  onSweep,
  sweepDisabled,
}: {
  metrics: CategoryMetrics;
  heroToken?: Token | null;
  onSweep?: () => void;
  sweepDisabled?: boolean;
}) {
  const { isWatchingCategory, toggleCategory } = useWatchlist();
  const watching = isWatchingCategory(metrics.slug);
  const isSyncing = metrics.marketStatus === 'syncing';
  return (
    <header className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link href="/market" className="transition-colors hover:text-[var(--color-text-primary)]">
          Market
        </Link>
        <span>/</span>
        <Link href="/categories" className="transition-colors hover:text-[var(--color-text-primary)]">
          Categories
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text-secondary)]">{metrics.name}</span>
      </nav>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="text-eyebrow">{FAMILY_LABEL[metrics.family] ?? metrics.family}</span>
            <LiveIndicator
              tone={isSyncing ? 'amber' : 'green'}
              size={6}
              label={
                isSyncing
                  ? `Verified ${metrics.verifiedCount.toLocaleString()} / ${metrics.memberSupply.toLocaleString()}`
                  : 'Live'
              }
            />
          </div>
          <h1 className="text-display text-[clamp(2.5rem,5.5vw,4.5rem)] text-[var(--color-text-primary)]">
            {metrics.name}
          </h1>
          <p className="text-body max-w-[58ch] text-[var(--color-text-secondary)] md:text-[17px]">
            {metrics.description}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {onSweep ? (
              <button
                type="button"
                className="nv-button"
                onClick={onSweep}
                disabled={sweepDisabled}
              >
                Sweep category
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => toggleCategory(metrics.slug)}
              className="nv-button nv-button-ghost"
              aria-pressed={watching}
            >
              <Star size={14} weight={watching ? 'fill' : 'regular'} />
              {watching ? 'Watching' : 'Watch category'}
            </button>
          </div>
        </div>
        {heroToken ? (
          <Link
            href={`/tokens/${heroToken.tokenId}`}
            className="relative aspect-square overflow-hidden rounded-[var(--radius-hero)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] lg:col-span-5"
          >
            <Image
              src={heroToken.imageUrl}
              alt={`Button Presser #${heroToken.tokenId}`}
              fill
              sizes="(min-width: 1024px) 28rem, 100vw"
              unoptimized={isProxyImageUrl(heroToken.imageUrl) || heroToken.imageUrl.endsWith('.svg')}
              className="object-contain p-6"
            />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
