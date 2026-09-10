'use client';

import { useEffect, useState } from 'react';
import { MarketHeader } from './MarketHeader';
import { SearchCommand } from './SearchCommand';
import type { Token, CategoryMetrics } from '@/lib/market';

/**
 * MarketHeader + SearchCommand bundle. The header is sticky so this
 * wrapper must live as a single client island in the root layout.
 */
export function MarketHeaderClient({
  tokens,
  categories,
}: {
  tokens?: Token[];
  categories?: CategoryMetrics[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <MarketHeader onOpenSearch={() => setSearchOpen(true)} />
      <SearchCommand
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        tokens={tokens ?? []}
        categories={categories ?? []}
      />
    </>
  );
}
