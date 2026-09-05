import Link from 'next/link';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { MarketView } from '@/components/ui/MarketView';
import { listTokens } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market — Net Vision',
  description: 'Every active Button Presser listing on Robinhood Chain.',
};

export default async function MarketPage() {
  const [tokens, freshness] = await Promise.all([
    listTokens({ listedOnly: true, limit: 60 }),
    getMarketSource().getFreshness(),
  ]);

  const listedCount = tokens.length;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">Market</span>
          <LiveIndicator
            tone={freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={freshness.fresh ? 'Live' : 'Warming'}
          />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h1 className="text-display text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--color-text-primary)]">
            Every active listing
          </h1>
          <span className="text-eyebrow-muted">
            {listedCount.toLocaleString()} live
          </span>
        </div>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          {listedCount === 0
            ? 'Live listings are warming up. The OpenSea indexer will surface active asks as soon as the collection finishes syncing.'
            : 'Active asks on Button Presser, ordered by the live OpenSea orderbook. Connect a wallet to buy or make an offer.'}
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
