'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChartLine,
  Cube,
  ListBullets,
  MagnifyingGlass,
  SquaresFour,
  Tag,
  Users,
} from '@phosphor-icons/react/dist/ssr';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
import { AssetCard } from '@/components/ui/AssetCard';
import { PaymentMethodStrip } from '@/components/commerce/PaymentMethodStrip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import { compact, payment } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { CategoryMetrics, CollectionSnapshot, DataFreshness, Token } from '@/lib/market';

type Sort = 'recent' | 'price-asc' | 'price-desc';

export function MarketShowroom({
  snapshot,
  freshness,
  tokens,
  categories,
  unavailable,
}: {
  snapshot: CollectionSnapshot;
  freshness: DataFreshness;
  tokens: Token[];
  categories: CategoryMetrics[];
  unavailable?: boolean;
}) {
  const [slug, setSlug] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('price-asc');
  const live = snapshot.marketStatus === 'live' && freshness.fresh;
  const pills = useMemo(
    () =>
      [...categories]
        .filter((c) => c.listedCount > 0)
        .sort((a, b) => b.listedCount - a.listedCount)
        .slice(0, 8),
    [categories],
  );

  const visible = useMemo(() => {
    let next = tokens;
    if (slug !== 'all') {
      next = next.filter((t) => t.traits.some((tr) => tr.slug === slug));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      next = next.filter(
        (t) =>
          t.tokenId.includes(q) ||
          t.traits.some((tr) => tr.label.toLowerCase().includes(q) || tr.slug.includes(q)),
      );
    }
    next = [...next].sort((a, b) => {
      if (sort === 'price-asc') return (a.listingPrice ?? Infinity) - (b.listingPrice ?? Infinity);
      if (sort === 'price-desc') return (b.listingPrice ?? -1) - (a.listingPrice ?? -1);
      return (b.listedAt ?? 0) - (a.listedAt ?? 0);
    });
    return next;
  }, [tokens, slug, query, sort]);

  return (
    <div className="flex flex-col gap-6">
      <CinematicHero
        imageSrc={SHOWROOM_MEDIA.marketHero}
        imageAlt="Cinematic Button Presser plaques staged in a showroom environment"
        eyebrow="Marketplace · Live"
        title={
          <>
            Button Presser
            <span className="mt-1 block text-[clamp(1.8rem,4.5vw,3.4rem)] text-[var(--color-net-green)]">
              The Market for Numbers.
            </span>
          </>
        }
        body="Collect. Trade. Build what's next. Iconic numbers. Real ownership. A more connected tomorrow."
        priority
        minHeightClass="min-h-[22rem] md:min-h-[26rem]"
        actions={
          <>
            <Link href="/categories" className="nv-button">
              Explore collection
            </Link>
            <Link href="/activity" className="nv-button nv-button-ghost">
              View analytics
            </Link>
          </>
        }
        aside={<ShowroomAside lines={['Same numbers.', 'Bigger', 'possibilities.']} />}
        metrics={[
          {
            label: 'Total items',
            value: compact(snapshot.totalSupply),
            icon: <Cube size={16} weight="duotone" />,
          },
          {
            label: live ? 'Active listings' : 'Known listed',
            value: snapshot.listedCount.toLocaleString(),
            icon: <ListBullets size={16} weight="duotone" />,
          },
          {
            label: 'Floor',
            value: payment(snapshot.floorPrice, snapshot.currency),
            icon: <Tag size={16} weight="duotone" />,
            emphasis: true,
          },
          {
            label: 'Owners',
            value: compact(snapshot.owners),
            icon: <Users size={16} weight="duotone" />,
          },
          {
            label: '24h volume',
            value: payment(snapshot.volume24hNative, 'ETH'),
            icon: <ChartLine size={16} weight="duotone" />,
          },
        ]}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={slug === 'all'} onClick={() => setSlug('all')} count={snapshot.totalSupply}>
          All Items
        </Pill>
        {pills.map((c) => (
          <Pill
            key={c.slug}
            active={slug === c.slug}
            onClick={() => setSlug(c.slug)}
            count={c.listedCount}
          >
            {c.name}
          </Pill>
        ))}
      </div>

      <div className="nv-glass flex flex-col gap-3 rounded-[18px] p-3 md:flex-row md:items-center">
        <span className="px-2 text-sm text-[var(--color-text-secondary)]">
          <span className="text-numeral font-semibold text-[var(--color-text-primary)]">
            {visible.length.toLocaleString()}
          </span>{' '}
          shown
        </span>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.35)] px-3">
          <MagnifyingGlass size={14} className="text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by number, trait, or id..."
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-10 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-4 text-sm"
        >
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="recent">Recently listed</option>
        </select>
      </div>

      {unavailable ? (
        <EmptyState
          title="Listings unavailable"
          body="The listing read model could not be loaded. This is not proof that nothing is listed."
          tone="warming"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No listings match"
          body="Try another category pill or wait for the indexer to surface verified asks."
          tone="muted"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-6">
          {visible.map((token, index) => (
            <AssetCard key={token.tokenId} token={token} priority={index < 6} />
          ))}
        </div>
      )}

      <PaymentMethodStrip />
    </div>
  );
}

function Pill({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
        active
          ? 'bg-[var(--color-net-green)] text-[var(--color-bg)]'
          : 'nv-glass text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
      )}
    >
      {active ? <SquaresFour size={13} weight="bold" /> : null}
      {children}
      <span className={cn('text-numeral text-[11px]', active ? 'opacity-80' : 'text-[var(--color-text-tertiary)]')}>
        {compact(count)}
      </span>
    </button>
  );
}
