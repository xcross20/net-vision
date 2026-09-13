'use client';

import Link from 'next/link';
import { useAccount, useDisconnect } from 'wagmi';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { address } from '@/lib/format';
import { useWatchlist } from '@/lib/watchlist/WatchlistProvider';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';

export default function ProfilePage() {
  const { address: addr, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { categories, toggleCategory } = useWatchlist();

  if (!isConnected) {
    return (
      <EmptyState
        title="Connect a wallet"
        body="Profile and settings follow the connected Robinhood Chain wallet. Nothing is stored as a social username."
        tone="muted"
      />
    );
  }

  const favorites = VIRTUAL_COLLECTION_CATALOG.filter((c) =>
    ['material-brass', 'digits-3', 'palindrome', 'repdigit', 'digits-4'].includes(c.slug),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="relative isolate overflow-hidden rounded-[24px] border border-[var(--color-border-subtle)]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${SHOWROOM_MEDIA.portfolioHero})` }}
        />
        <div className="nv-showroom-scrim absolute inset-0" />
        <div className="relative z-10 flex flex-col gap-3 p-6 md:p-8">
          <span className="text-eyebrow">Profile & settings</span>
          <h1 className="text-display text-[clamp(2rem,5vw,3.2rem)]">Wallet settings</h1>
          <p className="max-w-[56ch] text-sm text-[var(--color-text-secondary)]">
            This account is the connected wallet. Display names, listing manager, and Gear inventory
            from the mock are not live product.
          </p>
          <div className="nv-glass-2 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2">
            <LiveIndicator tone="green" size={6} label="Connected" />
            <span className="text-numeral text-sm">{address(addr ?? '')}</span>
          </div>
        </div>
      </header>

      <section className="nv-glass-2 flex flex-col gap-4 rounded-[20px] p-5 md:p-6">
        <h2 className="text-display text-xl">Favorite categories</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Watchlist only — this does not create a social profile.
        </p>
        <div className="flex flex-wrap gap-2">
          {favorites.map((cat) => {
            const on = categories.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => toggleCategory(cat.slug)}
                className={
                  on
                    ? 'rounded-full bg-[var(--color-net-green)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-bg)]'
                    : 'nv-glass-1 rounded-full px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)]'
                }
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="nv-glass-2 flex flex-col gap-3 rounded-[20px] p-5">
        <h2 className="text-display text-xl">Shortcuts</h2>
        <Link href="/portfolio" className="text-sm text-[var(--color-net-green)]">
          Open portfolio →
        </Link>
        <Link href="/market" className="text-sm text-[var(--color-text-secondary)]">
          Back to market
        </Link>
        <button
          type="button"
          onClick={() => disconnect()}
          className="mt-2 w-fit text-sm text-[var(--color-danger)]"
        >
          Disconnect wallet
        </button>
      </section>
    </div>
  );
}
