'use client';

import { useEffect, useState } from 'react';
import { MarketHeader } from './MarketHeader';
import { SearchCommand } from './SearchCommand';
import type { CategoryMetrics } from '@/lib/market';

/**
 * MarketHeader + SearchCommand bundle. Search data loads when the
 * palette opens so the root layout does not block every navigation
 * on listings + all-category SQL.
 */
export function MarketHeaderClient() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryMetrics[]>([]);

  useEffect(() => {
    if (!searchOpen || categories.length > 0) return;
    let cancelled = false;
    void fetch('/api/categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { categories?: Array<{ slug: string; name: string; description: string }> } | null) => {
        if (cancelled || !body?.categories) return;
        setCategories(
          body.categories.map((row) => ({
            slug: row.slug,
            name: row.name,
            description: row.description,
          })) as CategoryMetrics[],
        );
      })
      .catch(() => {
        /* search degrades to token-id jump only */
      });
    return () => {
      cancelled = true;
    };
  }, [searchOpen, categories.length]);

  return (
    <>
      <MarketHeader onOpenSearch={() => setSearchOpen(true)} />
      <SearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        tokens={[]}
        categories={categories}
      />
    </>
  );
}
