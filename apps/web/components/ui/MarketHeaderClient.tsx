'use client';

import { useState } from 'react';
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
