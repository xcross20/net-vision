'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { MetadataCoverage } from '@/lib/index/store';

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
  const [remoteTokens, setRemoteTokens] = useState<Token[] | null>(null);
  const [remoteTotal, setRemoteTotal] = useState<number | null>(null);
  const [remoteError, setRemoteError] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [coverage, setCoverage] = useState<MetadataCoverage | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/coverage', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as MetadataCoverage;
        if (!cancelled) setCoverage(json);
      } catch {
        if (!cancelled) setCoverage(null);
      }
    };
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  const live = snapshot.marketStatus === 'live' && freshness.fresh;
  const PINNED = ['palindrome', 'repdigit', 'digits-3', 'material-brass', 'digits-4', 'digits-5', 'double'];
  const pills = useMemo(() => {
    const bySlug = new Map(categories.map((c) => [c.slug, c]));
    const pinned = PINNED.map((slug) => bySlug.get(slug)).filter(
      (c): c is CategoryMetrics => Boolean(c),
    );
    const rest = categories
      .filter((c) => !PINNED.includes(c.slug) && c.listedCount > 0)
      .sort((a, b) => b.listedCount - a.listedCount);
    return [...pinned, ...rest].slice(0, 7);
  }, [categories]);

  useEffect(() => {
    if (slug === 'all') {
      setRemoteTokens(null);
      setRemoteTotal(null);
      setRemoteError(false);
      setRemoteLoading(false);
      return;
    }
    const controller = new AbortController();
    setRemoteLoading(true);
    setRemoteError(false);
    setRemoteTokens(null);
    const params = new URLSearchParams({ limit: '48', offset: '0' });
    if (query.trim()) params.set('q', query.trim());
    void fetch(`/api/categories/${encodeURIComponent(slug)}/listings?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`listings ${res.status}`);
        return (await res.json()) as { tokens?: Token[]; total?: number };
      })
      .then((body) => {
        setRemoteTokens(body.tokens ?? []);
        setRemoteTotal(typeof body.total === 'number' ? body.total : (body.tokens ?? []).length);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setRemoteTokens([]);
        setRemoteTotal(null);
        setRemoteError(true);
        void err;
      })
      .finally(() => {
        if (!controller.signal.aborted) setRemoteLoading(false);
      });
    return () => controller.abort();
  }, [slug, query]);

  const visible = useMemo(() => {
    let next = slug === 'all' ? tokens : (remoteTokens ?? []);
    if (slug === 'all' && query.trim()) {
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
  }, [tokens, remoteTokens, slug, query, sort]);

  const listedLabelCount =
    slug === 'all'
      ? snapshot.listedCount
      : (remoteTotal ?? pills.find((c) => c.slug === slug)?.listedCount ?? snapshot.listedCount);
  const selectedCategory = pills.find((c) => c.slug === slug);

  return (
    <div className="flex flex-col gap-5">
      <MarketHero
        coverage={
          coverage
            ? { verified: coverage.verified, total: coverage.total, lastFetchAt: coverage.lastSuccessAt }
            : undefined
        }
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

      <div className="nv-glass-2 flex flex-col gap-3 rounded-[18px] p-3 md:flex-row md:items-center md:px-4">
        <div className="px-2">
          <div className="text-numeral text-lg font-semibold text-[var(--color-text-primary)]">
            {listedLabelCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)]">
            {live ? 'Items listed' : 'Known listed'}{' '}
            {selectedCategory ? `in ${selectedCategory.name}` : 'in Button Presser'}
          </div>
        </div>
        <label className="nv-glass-1 flex min-w-0 flex-1 items-center gap-2 rounded-full px-4">
          <MagnifyingGlass size={15} className="text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by number (e.g. 777), trait, or id..."
            className="h-11 w-full bg-transparent text-[15px] outline-none"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="nv-glass-1 h-11 rounded-[14px] px-4 text-sm"
        >
          <option value="price-asc">Sort by: Price Low to High</option>
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
      ) : remoteError ? (
        <EmptyState
          title="Listings unavailable"
          body="This category's listings could not be loaded. This is not proof that nothing is listed."
          tone="warming"
        />
      ) : remoteLoading ? (
        <EmptyState
          title="Loading listings"
          body={`Fetching verified asks in ${selectedCategory?.name ?? 'this category'}.`}
          tone="muted"
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
