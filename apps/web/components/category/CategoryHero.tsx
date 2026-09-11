'use client';

import Link from 'next/link';
import {
  ChartLine,
  Crown,
  ListBullets,
  ShoppingCart,
  Star,
  Tag,
  TrendUp,
  Users,
} from '@phosphor-icons/react/dist/ssr';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import { compact, payment, pct } from '@/lib/format';
import type { CategoryMetrics } from '@/lib/market';

const FAMILY_LABEL: Record<string, string> = {
  number: 'Number',
  material: 'Material',
  pattern: 'Pattern',
  culture: 'Culture',
};

export function CategoryHero({
  metrics,
  onSweep,
  sweepDisabled,
}: {
  metrics: CategoryMetrics;
  heroToken?: unknown;
  onSweep?: () => void;
  sweepDisabled?: boolean;
}) {
  const { isWatchingCategory, toggleCategory } = useWatchlist();
  const watching = isWatchingCategory(metrics.slug);
  const isSyncing = metrics.marketStatus === 'syncing';
  const currency = metrics.currency;

  return (
    <div className="flex flex-col gap-4">
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

      <CinematicHero
        imageSrc={SHOWROOM_MEDIA.categoryHero}
        imageAlt={`Cinematic showroom photography for the ${metrics.name} category`}
        eyebrow={`${FAMILY_LABEL[metrics.family] ?? metrics.family} category`}
        title={metrics.name}
        body={metrics.description}
        minHeightClass="min-h-[26rem] md:min-h-[30rem]"
        metricsVariant="bar"
        aside={
          <ShowroomAside
            lines={['Same numbers.', 'Bigger', 'possibilities.']}
            footer={
              <LiveIndicator
                tone={isSyncing ? 'amber' : 'green'}
                size={6}
                label={
                  isSyncing
                    ? `Verified ${metrics.verifiedCount.toLocaleString()} / ${metrics.memberSupply.toLocaleString()}`
                    : 'Live'
                }
              />
            }
          />
        }
        actions={
          <>
            {onSweep ? (
              <button
                type="button"
                className="nv-button"
                onClick={onSweep}
                disabled={sweepDisabled}
              >
                <ShoppingCart size={15} weight="bold" />
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
          </>
        }
        metrics={[
          {
            label: 'Floor (USDG)',
            value: isSyncing ? 'Syncing' : payment(metrics.floorPrice, currency),
            icon: <Tag size={16} weight="duotone" />,
            emphasis: true,
          },
          {
            label: 'Best offer',
            value: isSyncing ? '—' : payment(metrics.topOfferPrice, currency),
            icon: <TrendUp size={16} weight="duotone" />,
          },
          {
            label: isSyncing ? 'Known listed' : 'Listed',
            value: metrics.listedCount.toLocaleString(),
            icon: <ListBullets size={16} weight="duotone" />,
          },
          {
            label: 'Owners',
            value: metrics.owners.toLocaleString(),
            icon: <Users size={16} weight="duotone" />,
          },
          {
            label: '24h volume',
            value: isSyncing ? '—' : compact(metrics.volume24h),
            icon: <ChartLine size={16} weight="duotone" />,
          },
          {
            label: '7d volume',
            value: isSyncing ? '—' : compact(metrics.volume7d),
            icon: <ChartLine size={16} weight="duotone" />,
          },
          {
            label: 'Highest sale',
            value: isSyncing ? '—' : payment(metrics.highestSale?.price ?? null, currency),
            icon: <Crown size={16} weight="duotone" />,
          },
          {
            label: '7d floor',
            value: isSyncing ? '—' : pct(metrics.floorChange7d),
            icon: <TrendUp size={16} weight="duotone" />,
          },
        ]}
      />
    </div>
  );
}
