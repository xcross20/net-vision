import Link from 'next/link';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { getRecentOffers, getRecentSales } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Activity — Net Vision',
  description: 'Recent sales and offers across the Button Presser collection.',
};

export default async function ActivityPage() {
  const [sales, offers, freshness] = await Promise.all([
    getRecentSales(24),
    getRecentOffers(24),
    getMarketSource().getFreshness(),
  ]);

  const saleEntries: SaleOrOfferEntry[] = sales.map((s) => ({
    kind: 'sale' as const,
    tokenId: s.tokenId,
    price: s.price,
    currency: s.currency,
    occurredAt: s.occurredAt,
    orderHash: s.orderHash,
    buyer: s.buyer,
    seller: s.seller,
  }));
  const offerEntries: SaleOrOfferEntry[] = offers.map((o) => ({
    kind: 'offer' as const,
    tokenId: o.tokenId,
    price: o.price,
    currency: o.currency,
    occurredAt: o.expiresAt ?? Math.floor(Date.now() / 1000),
    orderHash: o.orderHash,
    maker: o.maker,
    expiresAt: o.expiresAt,
  }));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">Activity</span>
          <LiveIndicator
            tone={freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={freshness.fresh ? 'Live' : 'Warming'}
          />
        </div>
        <h1 className="text-display text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--color-text-primary)]">
          Recent market activity
        </h1>
        <p className="text-body max-w-[60ch] text-[var(--color-text-secondary)]">
          A live tape of cleared trades and open offers across the Button Presser collection
          on Robinhood Chain.
        </p>
      </header>

      {saleEntries.length === 0 && offerEntries.length === 0 ? (
        <EmptyState
          title="Activity will appear once trades clear"
          body="The orderbook is settling in. Recent sales and offers will stream in as the OpenSea indexer finishes warming up."
          tone="warming"
          action={
            <Link href="/market" className="nv-button nv-button-ghost">
              Open the market
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <SalesOffersList
            title="Sales"
            type="sale"
            entries={saleEntries}
            empty="No cleared sales yet."
          />
          <SalesOffersList
            title="Offers"
            type="offer"
            entries={offerEntries}
            empty="No open offers right now."
          />
        </div>
      )}
    </div>
  );
}
