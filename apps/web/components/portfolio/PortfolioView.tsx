'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import type { Token } from '@/lib/market';
import { CollectibleCard } from '@/components/market/CollectibleCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { payment } from '@/lib/format';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';

type Tab = 'inventory' | 'listed' | 'offers' | 'watchlist' | 'activity';

export function PortfolioView() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>('inventory');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const { tokens: watchedIds, categories: watchedCategories } = useWatchlist();

  useEffect(() => {
    if (!address) return;
    void fetch(`/api/v1/account/${address}/nfts`)
      .then((res) => {
        if (!res.ok) throw new Error(`nfts ${res.status}`);
        return res.json();
      })
      .then((body: { tokens?: Token[] }) => {
        setUnavailable(false);
        setTokens(body.tokens ?? []);
      })
      .catch(() => {
        setUnavailable(true);
        setTokens([]);
      });
  }, [address]);

  const listed = tokens.filter((t) => t.listingPrice !== null);
  const exposure = useMemo(() => {
    const counts = new Map<string, number>();
    for (const token of tokens) {
      for (const trait of token.traits) {
        counts.set(trait.slug, (counts.get(trait.slug) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([slug, count]) => ({
        slug,
        count,
        label: VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug)?.name ?? slug,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tokens]);

  const contextValue = tokens.reduce((sum, token) => {
    if (token.listingPrice !== null) return sum + token.listingPrice;
    if (token.lastSalePrice !== null) return sum + token.lastSalePrice;
    return sum;
  }, 0);

  if (!isConnected) {
    return (
      <EmptyState
        title="Connect a wallet"
        body="Portfolio shows every Button Presser you own, listed or not."
        tone="muted"
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="text-eyebrow">Portfolio</span>
        <h1 className="text-display text-[clamp(2.25rem,5vw,3.5rem)]">Your Buttons</h1>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          {unavailable
            ? 'Inventory unavailable — not the same as an empty wallet.'
            : `${tokens.length} total · Estimated context value ${payment(contextValue, 'USDG')}`}
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        {exposure.map((row) => (
          <Link
            key={row.slug}
            href={`/categories/${row.slug}`}
            className="rounded-full border border-[var(--color-border-subtle)] px-3 py-1 text-sm text-[var(--color-text-secondary)]"
          >
            {row.label} {row.count}
          </Link>
        ))}
      </div>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        tabs={[
          { value: 'inventory', label: 'Inventory', count: tokens.length },
          { value: 'listed', label: 'Listed', count: listed.length },
          { value: 'offers', label: 'Offers' },
          { value: 'watchlist', label: 'Watchlist', count: watchedIds.length + watchedCategories.length },
          { value: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'inventory' || tab === 'listed' ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {(tab === 'listed' ? listed : tokens).map((token) => (
            <div key={token.tokenId} className="flex flex-col gap-2">
              <CollectibleCard token={token} selectable={false} />
              <ListAssetButton token={token} />
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'watchlist' ? (
        <div className="flex flex-col gap-3">
          {watchedCategories.map((slug) => (
            <Link key={slug} href={`/categories/${slug}`} className="text-sm hover:text-[var(--color-net-green)]">
              {VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug)?.name ?? slug}
            </Link>
          ))}
          {watchedIds.map((id) => (
            <Link key={id} href={`/tokens/${id}`} className="text-sm hover:text-[var(--color-net-green)]">
              #{id}
            </Link>
          ))}
          {watchedCategories.length === 0 && watchedIds.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">Watch a category or token to pin it here.</p>
          ) : null}
        </div>
      ) : null}

      {tab === 'offers' || tab === 'activity' ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Offers and activity appear as the indexer records them for this wallet.
        </p>
      ) : null}
    </div>
  );
}

function ListAssetButton({ token }: { token: Token }) {
  const href = `https://opensea.io/assets/robinhood/${BUTTON_PRESSER_COLLECTION.contractAddress}/${token.tokenId}`;
  const listed = token.listingPrice !== null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="nv-button nv-button-ghost text-center"
    >
      {listed ? 'Edit listing' : 'List'}
    </a>
  );
}
