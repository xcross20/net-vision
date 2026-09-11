import Link from 'next/link';
import {
  ChartLine,
  ListBullets,
  Tag,
  Users,
} from '@phosphor-icons/react/dist/ssr';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import { getCollectionSnapshot, getRecentOffers, getRecentSales } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { compact, payment } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Activity — Net Vision',
  description: 'Recent sales and offers across the Button Presser collection.',
};

export default async function ActivityPage() {
  const [sales, offers, freshness, snapshot] = await Promise.all([
    getRecentSales(24),
    getRecentOffers(24),
    getMarketSource().getFreshness(),
    getCollectionSnapshot().catch(() => null),
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
    <div className="flex flex-col gap-8">
      <CinematicHero
        imageSrc={SHOWROOM_MEDIA.activityHero}
        imageAlt="Cinematic Button Presser plaques for live market activity"
        eyebrow="Live market activity"
        title={
          <>
            Every number <span className="text-[var(--color-net-green)]">tells a story.</span>
          </>
        }
        body="Real-time trades, listings, offers, and more. Track the pulse of Button Presser on Robinhood Chain."
        aside={<ShowroomAside lines={['Same numbers.', 'Bigger', 'possibilities.']} />}
        metrics={
          snapshot
            ? [
                {
                  label: '24h volume',
                  value: payment(snapshot.volume24hNative, 'ETH'),
                  icon: <ChartLine size={16} weight="duotone" />,
                },
                {
                  label: '24h sales',
                  value: compact(snapshot.sales24h),
                  icon: <Tag size={16} weight="duotone" />,
                },
                {
                  label: liveLabel(freshness.fresh),
                  value: snapshot.listedCount.toLocaleString(),
                  icon: <ListBullets size={16} weight="duotone" />,
                },
                {
                  label: 'Owners',
                  value: compact(snapshot.owners),
                  icon: <Users size={16} weight="duotone" />,
                },
              ]
            : undefined
        }
      />

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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <aside className="nv-glass flex flex-col gap-2 rounded-[18px] p-4 lg:col-span-3">
            <h2 className="text-display text-lg">Market activity</h2>
            <LiveIndicator
              tone={freshness.fresh ? 'green' : 'amber'}
              size={6}
              label={freshness.fresh ? 'Live' : 'Warming'}
            />
            <Link href="/activity" className="nv-chip nv-chip-strong w-fit">
              All activity
            </Link>
            <Link href="/activity" className="nv-chip w-fit">
              Sales {saleEntries.length}
            </Link>
            <Link href="/activity?type=offer" className="nv-chip w-fit">
              Offers {offerEntries.length}
            </Link>
            <p className="pt-4 text-[12px] text-[var(--color-text-tertiary)]">
              Sweeps, transfers, and trader rankings are hidden until those feeds are backed.
            </p>
          </aside>
          <div className="lg:col-span-9">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <SalesOffersList title="Sales" type="sale" entries={saleEntries} empty="No cleared sales yet." />
              <SalesOffersList title="Offers" type="offer" entries={offerEntries} empty="No open offers yet." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function liveLabel(fresh: boolean) {
  return fresh ? 'Listed' : 'Known listed';
}
