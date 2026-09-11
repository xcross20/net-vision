'use client';

import { useMemo, useState } from 'react';
import {
  ChartLine,
  Cube,
  ListBullets,
  MagnifyingGlass,
  SquaresFour,
  Tag,
  Users,
} from '@phosphor-icons/react/dist/ssr';
import { motion } from 'motion/react';
import { MarketHero } from '@/components/v2/market/MarketHero';
import { AssetCard } from '@/components/ui/AssetCard';
import { PaymentMethodStrip } from '@/components/commerce/PaymentMethodStrip';
import { EmptyState } from '@/components/ui/EmptyState';
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
    <div className="flex flex-col gap-8">
      <MarketHero
        metrics={[
          {
            label: 'Total items',
            value: compact(snapshot.totalSupply),
            icon: <Cube size={18} weight="duotone" />,
          },
          {
            label: live ? 'Active listings' : 'Known listed',
            value: snapshot.listedCount.toLocaleString(),
            icon: <ListBullets size={18} weight="duotone" />,
          },
          {
            label: 'Floor',
            value: payment(snapshot.floorPrice, snapshot.currency),
            icon: <Tag size={18} weight="duotone" />,
            emphasis: true,
          },
          {
            label: 'Owners',
            value: compact(snapshot.owners),
            icon: <Users size={18} weight="duotone" />,
          },
          {
            label: '24h volume',
            value: payment(snapshot.volume24hNative, 'ETH'),
            icon: <ChartLine size={18} weight="duotone" />,
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

      <div className="nv-glass-2 flex flex-col gap-3 rounded-[20px] p-3 md:flex-row md:items-center md:px-4">
        <span className="px-2 text-sm text-[var(--color-text-secondary)]">
          <span className="text-numeral text-base font-semibold text-[var(--color-text-primary)]">
            {visible.length.toLocaleString()}
          </span>{' '}
          shown
        </span>
        <label className="nv-glass-1 flex min-w-0 flex-1 items-center gap-2 rounded-full px-4">
          <MagnifyingGlass size={15} className="text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by number, trait, or id..."
            className="h-12 w-full bg-transparent text-[15px] outline-none"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="nv-glass-1 h-12 rounded-full px-4 text-sm"
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((token, index) => (
            <motion.div
              key={token.tokenId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 7) * 0.04, duration: 0.35 }}
            >
              <AssetCard token={token} priority={index < 4} />
            </motion.div>
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
        'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-[border-color,box-shadow,background-color]',
        active
          ? 'bg-[var(--color-net-green)] text-[var(--color-bg)] shadow-[0_0_24px_rgba(72,235,145,0.28)]'
          : 'nv-glass-1 text-[var(--color-text-secondary)] hover:border-[rgba(92,255,153,0.28)] hover:text-[var(--color-text-primary)]',
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
