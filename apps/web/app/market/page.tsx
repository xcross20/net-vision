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
import { FilterIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market — Net Vision',
  description: 'Every active Button Presser listing on Robinhood Chain.',
};

export default async function MarketPage() {
  const tokens = await listTokens({ listedOnly: true, limit: 60 });
  const freshness = await getMarketSource().getFreshness();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="nv-eyebrow">Market</span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h1 className="nv-display text-3xl md:text-5xl">Every active listing</h1>
          <span className="nv-label inline-flex items-center gap-1.5">
            <FilterIcon size={12} weight="bold" />
            {tokens.length} live
          </span>
        </div>
        <p className="nv-body">
          {tokens.length === 0
            ? 'Live listings are unavailable while the OpenSea indexer warms up.'
            : 'Active asks on Button Presser, ordered by the live OpenSea orderbook. Connect a wallet to buy or make an offer.'}
        </p>
      </header>

      {tokens.length > 0 ? (
        <>
          <div className="hidden grid-cols-12 gap-4 border-y border-[var(--nv-border)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--nv-muted)] md:grid">
            <div className="col-span-1">Token</div>
            <div className="col-span-4">Image</div>
            <div className="col-span-3">Traits</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Owner</div>
          </div>
          <div className="hidden flex-col md:flex">
            {tokens.map((t: Token) => (
              <TokenRow key={t.tokenId} token={t} />
            ))}
          </div>
          <div className="nv-grid-tokens md:hidden">
            {tokens.map((t: Token) => (
              <TokenCard key={t.tokenId} token={t} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}