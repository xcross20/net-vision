import Link from 'next/link';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { MarketView } from '@/components/ui/MarketView';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market — Net Vision',
  description: 'Every active Button Presser listing on Robinhood Chain.',
};

export default async function MarketPage() {
  const source = getMarketSource();
  const [page, snapshot, freshness] = await Promise.all([
    source.listTokens({ listedOnly: true, limit: 60 }),
    source.getCollectionSnapshot(),
    source.getFreshness(),
  ]);
  const tokens = page.tokens;
  const listedCount = snapshot.listedCount;
  const syncing = snapshot.marketStatus === 'syncing';
  const live = snapshot.marketStatus === 'live' && freshness.fresh;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">Market</span>
          <LiveIndicator
            tone={live ? 'green' : 'amber'}
            size={6}
            label={live ? 'Live' : 'Syncing'}
          />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="text-display text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--color-text-primary)]">
            Every active listing
          </h1>
          <span className="text-eyebrow-muted">
            {listedCount.toLocaleString()} {syncing ? 'known listed' : 'listed'}
          </span>
        </div>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          {listedCount === 0
            ? 'Verified listings are still syncing. Unknown tokens are not treated as unlisted.'
            : syncing
              ? 'Known verified asks from the worker index. Coverage is still below live threshold — this is not a complete book.'
              : 'Active verified asks on Button Presser. Connect a wallet to buy or make an offer.'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/categories" className="nv-button nv-button-ghost">
            Filter by category
          </Link>
          <Link href="/activity" className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">
            Recent activity →
          </Link>
        </div>
      </header>

      <MarketView tokens={tokens} categories={[]} />
    </div>
  );
}
