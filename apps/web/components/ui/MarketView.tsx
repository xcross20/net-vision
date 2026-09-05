'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs } from '@/components/ui/Tabs';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { AssetCard } from '@/components/ui/AssetCard';
import { AssetRow } from '@/components/ui/AssetRow';
import { AssetSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';

type View = 'grid' | 'list';
type Filter = 'all' | 'palindrome' | 'repeating' | '3digit';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'palindrome', label: 'Palindromes' },
  { value: 'repeating', label: 'Repeating' },
  { value: '3digit', label: '3 Digit' },
];

function traitFilter(t: Token, filter: Filter): boolean {
  if (filter === 'all') return true;
  const slugs = new Set(t.traits.map((tr) => tr.slug));
  if (filter === 'palindrome') return slugs.has('palindrome');
  if (filter === 'repeating') return slugs.has('repeating-pairs') || slugs.has('repeating-run');
  if (filter === '3digit') return slugs.has('digits-1');
  return true;
}

const SORT_OPTIONS = [
  { value: 'recent', label: 'Listed' },
  { value: 'price-asc', label: 'Price ▲' },
  { value: 'price-desc', label: 'Price ▼' },
] as const;
type Sort = (typeof SORT_OPTIONS)[number]['value'];

/**
 * Client island that owns the market view state (filter, sort, density).
 * The server passes the raw token list; filtering/sorting happen here
 * so they feel instantaneous.
 */
export function MarketView({
  tokens,
  categories,
}: {
  tokens: Token[];
  categories: { value: string; label: string }[];
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('grid');
  const [sort, setSort] = useState<Sort>('recent');

  const filtered = useMemo(() => {
    const out = tokens.filter((t) => traitFilter(t, filter));
    if (sort === 'recent') {
      out.sort((a, b) => (b.listedAt ?? 0) - (a.listedAt ?? 0));
    } else if (sort === 'price-asc') {
      out.sort((a, b) => Number(a.listingPriceEth ?? Infinity) - Number(b.listingPriceEth ?? Infinity));
    } else if (sort === 'price-desc') {
      out.sort((a, b) => Number(b.listingPriceEth ?? -1) - Number(a.listingPriceEth ?? -1));
    }
    return out;
  }, [tokens, filter, sort]);

  const tabs = [
    { value: 'all', label: 'All', count: tokens.length },
    ...FILTERS.filter((f) => f.value !== 'all').map((f) => ({
      value: f.value,
      label: f.label,
      count: tokens.filter((t) => traitFilter(t, f.value)).length,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Tabs
          tabs={tabs.map((t) => ({ value: t.value, label: t.label, count: t.count }))}
          value={filter === 'all' ? 'all' : filter}
          onChange={(v) => setFilter((v as Filter) ?? 'all')}
          className="-mx-1"
        />
        <div className="flex items-center gap-3">
          <SegmentedControl<Sort>
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={sort}
            onChange={setSort}
          />
          <SegmentedControl<View>
            options={[
              { value: 'grid', label: 'Grid', ariaLabel: 'Grid view' },
              { value: 'list', label: 'List', ariaLabel: 'List view' },
            ]}
            value={view}
            onChange={setView}
            className="ml-1"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div
            key={`grid-${filter}-${sort}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-4"
          >
            {filtered.length === 0
              ? Array.from({ length: 8 }).map((_, i) => <AssetSkeleton key={i} />)
              : filtered.map((t, idx) => (
                  <AssetCard key={t.tokenId} token={t} priority={idx < 4} />
                ))}
          </motion.div>
        ) : (
          <motion.div
            key={`list-${filter}-${sort}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'flex flex-col divide-y divide-[var(--color-border-subtle)]',
              'rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-1 py-1',
            )}
          >
            <div
              className={cn(
                'hidden grid-cols-[3rem_2.25rem_minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_5.5rem_minmax(0,1fr)_2.5rem]',
                'items-center gap-3 px-3 py-2 text-eyebrow-muted md:grid',
              )}
            >
              <span>#</span>
              <span />
              <span>Asset</span>
              <span>Category</span>
              <span className="text-right">Price</span>
              <span className="text-right">Last</span>
              <span>Owner / Listed</span>
              <span className="text-right" />
            </div>
            {filtered.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <AssetSkeleton key={i} />)
              : filtered.map((t) => <AssetRow key={t.tokenId} token={t} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
