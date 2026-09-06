'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryMetrics, Token } from '@/lib/market';
import { useLiveCategory } from '@/lib/market/use-live-metrics';
import { CategoryHero } from './CategoryHero';
import { CategoryMetricsStrip } from './CategoryMetrics';
import { CategoryTabs, type CategoryTab } from './CategoryTabs';
import { CategoryListings } from './CategoryListings';
import { CategorySales } from './CategorySales';
import { CategoryOffers } from './CategoryOffers';
import { CategoryAnalytics } from './CategoryAnalytics';
import { SelectionBar } from '@/components/market/SelectionBar';
import { SweepDrawer } from '@/components/sweep/SweepDrawer';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';

const PAGE_SIZE = 48;

export function CategoryMarket({
  metrics,
  initialTokens,
  initialTotal,
}: {
  metrics: CategoryMetrics;
  initialTokens: Token[];
  initialTotal?: number;
}) {
  const liveMetrics = useLiveCategory(metrics, 8_000);
  const [tab, setTab] = useState<CategoryTab>('listings');
  const [selected, setSelected] = useState<Record<string, Token>>({});
  const [query, setQuery] = useState('');
  const [material, setMaterial] = useState('');
  const [pattern, setPattern] = useState('');
  const [sweepOpen, setSweepOpen] = useState(false);
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [total, setTotal] = useState(initialTotal ?? metrics.listedCount);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialTokens.length < (initialTotal ?? metrics.listedCount) ? initialTokens.length : null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestKey = useRef('');

  const selectedTokens = Object.values(selected);
  const materials = VIRTUAL_COLLECTION_CATALOG.filter((c) => c.family === 'material');
  const patterns = VIRTUAL_COLLECTION_CATALOG.filter((c) => c.family === 'pattern');

  const filterKey = `${metrics.slug}|${query}|${material}|${pattern}`;

  const loadPage = useCallback(
    async (offset: number, replace: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (query.trim()) params.set('q', query.trim());
      if (material) params.set('material', material);
      if (pattern) params.set('pattern', pattern);
      const key = `${filterKey}|${offset}`;
      requestKey.current = key;
      setLoadingMore(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/categories/${encodeURIComponent(metrics.slug)}/listings?${params.toString()}`,
        );
        if (!res.ok) throw new Error(`listings ${res.status}`);
        const body = (await res.json()) as {
          tokens?: Token[];
          total?: number;
          nextOffset?: number | null;
        };
        if (requestKey.current !== key) return;
        const pageTokens = body.tokens ?? [];
        setTotal(body.total ?? pageTokens.length);
        setNextOffset(body.nextOffset ?? null);
        setTokens((current) => {
          if (replace) return pageTokens;
          const seen = new Set(current.map((token) => token.tokenId));
          return [...current, ...pageTokens.filter((token) => !seen.has(token.tokenId))];
        });
      } catch (err) {
        if (requestKey.current === key) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load listings');
        }
      } finally {
        if (requestKey.current === key) setLoadingMore(false);
      }
    },
    [filterKey, material, metrics.slug, pattern, query],
  );

  // Refetch from offset 0 when filters change (skip first mount — SSR already loaded).
  const filtersReady = useRef(false);
  useEffect(() => {
    if (!filtersReady.current) {
      filtersReady.current = true;
      // Still refresh once so orderbook-reconciled floor (e.g. #966) appears.
      void loadPage(0, true);
      return;
    }
    setTokens([]);
    setNextOffset(0);
    void loadPage(0, true);
  }, [filterKey, loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || tab !== 'listings') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (loadingMore || nextOffset == null) return;
        void loadPage(nextOffset, false);
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadPage, loadingMore, nextOffset, tab]);

  const visible = useMemo(() => tokens, [tokens]);

  const toggle = (token: Token) => {
    setSelected((current) => {
      const next = { ...current };
      if (next[token.tokenId]) delete next[token.tokenId];
      else next[token.tokenId] = token;
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-10 pb-24">
      <CategoryHero metrics={liveMetrics} />
      <CategoryMetricsStrip metrics={liveMetrics} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CategoryTabs value={tab} onChange={setTab} listedCount={liveMetrics.listedCount} />
          {tab === 'listings' ? (
            <button
              type="button"
              className="nv-button nv-button-ghost"
              onClick={() => setSweepOpen(true)}
              disabled={liveMetrics.marketStatus === 'syncing'}
            >
              Sweep {liveMetrics.name}
            </button>
          ) : null}
        </div>

        {tab === 'listings' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this category..."
                className="h-10 min-w-[12rem] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm"
              />
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm"
              >
                <option value="">Material</option>
                {materials.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 text-sm"
              >
                <option value="">Pattern</option>
                {patterns.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Showing {visible.length.toLocaleString()}
              {total > 0 ? ` of ${total.toLocaleString()}` : ''} verified listings
              {liveMetrics.listedCount > total ? ` · metric ${liveMetrics.listedCount.toLocaleString()}` : ''}
            </p>
            <CategoryListings
              tokens={visible}
              selectedIds={new Set(Object.keys(selected))}
              onToggle={toggle}
              syncing={liveMetrics.marketStatus === 'syncing'}
              memberSupply={liveMetrics.memberSupply}
              verifiedCount={liveMetrics.verifiedCount}
            />
            <div ref={sentinelRef} className="flex min-h-10 items-center justify-center py-4">
              {loadingMore ? (
                <span className="text-xs text-[var(--color-text-tertiary)]">Loading more…</span>
              ) : nextOffset != null ? (
                <button
                  type="button"
                  className="nv-button nv-button-ghost text-xs"
                  onClick={() => void loadPage(nextOffset, false)}
                >
                  Load more listings
                </button>
              ) : visible.length > 0 ? (
                <span className="text-xs text-[var(--color-text-tertiary)]">End of listings</span>
              ) : null}
            </div>
            {loadError ? (
              <p className="text-xs text-[var(--color-danger)]">{loadError}</p>
            ) : null}
          </div>
        ) : null}
        {tab === 'sales' ? <CategorySales slug={metrics.slug} metrics={liveMetrics} /> : null}
        {tab === 'offers' ? <CategoryOffers slug={metrics.slug} /> : null}
        {tab === 'analytics' ? <CategoryAnalytics slug={metrics.slug} metrics={liveMetrics} /> : null}
      </div>
      <SelectionBar tokens={selectedTokens} onClear={() => setSelected({})} />
      <SweepDrawer
        open={sweepOpen}
        onClose={() => setSweepOpen(false)}
        slug={metrics.slug}
        name={metrics.name}
        tokens={tokens}
        enabled={liveMetrics.marketStatus === 'live'}
      />
    </div>
  );
}
