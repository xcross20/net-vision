/**
 * /market: the Button Presser marketplace.
 *
 * Primary commerce surface. Lives at /market so customer-facing links
 * match the vocabulary ("Market", "Browse the market") used in
 * navigation and marketing.
 */
import { listTokens } from '@/lib/data/tokens';
import { TokenCard } from '@/components/TokenCard';
import { TokenRow } from '@/components/TokenRow';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { getMarketSource } from '@/lib/market';
import type { Token } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market — Net Vision',
  description: 'Every active Button Presser listing on Robinhood Chain.',
};

export default async function MarketPage() {
  const tokens = await listTokens({ listedOnly: true, limit: 60 });
  const freshness = await getMarketSource().getFreshness();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[var(--nv-green)] text-xs uppercase tracking-[0.18em]">
            Market
          </span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold">Every listing</h1>
        <p className="text-[var(--nv-muted)]">
          {tokens.length === 0
            ? 'Live listings are unavailable while the OpenSea indexer warms up.'
            : `${tokens.length} active listings on Robinhood Chain.`}
        </p>
      </header>

      {tokens.length > 0 ? (
        <>
          <div className="hidden md:grid grid-cols-12 gap-4 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--nv-muted)] border-y border-[var(--nv-border)]">
            <div className="col-span-1">Token</div>
            <div className="col-span-4">Image</div>
            <div className="col-span-3">Traits</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Owner</div>
          </div>
          <div className="hidden md:flex flex-col">
            {tokens.map((t: Token) => (
              <TokenRow key={t.tokenId} token={t} />
            ))}
          </div>
          <div className="md:hidden nv-grid">
            {tokens.map((t: Token) => (
              <TokenCard key={t.tokenId} token={t} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
