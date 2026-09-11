import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { LayeredHeroArt } from '@/components/ui/LayeredHeroArt';
import { CollectionPulse } from '@/components/ui/CollectionPulse';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { AssetCard } from '@/components/ui/AssetCard';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaymentMethodStrip } from '@/components/commerce/PaymentMethodStrip';
import { compact, payment } from '@/lib/format';
import { listCategories } from '@/lib/data/categories';
import {
  getCollectionSnapshot,
  getRecentOffers,
  getRecentSales,
  listTokens,
} from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { baseCollectionSnapshot } from '@/lib/market/collection-facts';
import type { CategoryMetrics } from '@/lib/market';

export const dynamic = 'force-dynamic';

async function settle<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await promise };
  } catch {
    return { ok: false };
  }
}

export default async function HomePage() {
  const [snapshotRaw, tokensLoad, categoriesLoad, freshness, salesLoad, offersLoad] =
    await Promise.all([
      getCollectionSnapshot().catch(() => null),
      settle(listTokens({ listedOnly: true, limit: 8 })),
      settle(listCategories()),
      getMarketSource()
        .getFreshness()
        .catch(() => ({
          fresh: false,
          refreshedAt: null as number | null,
          source: 'cache' as const,
          resolvedChainSlug: null as string | null,
        })),
      settle(getRecentSales(8)),
      settle(getRecentOffers(8)),
    ]);
  const snapshot = snapshotRaw ?? baseCollectionSnapshot();
  const tokens = tokensLoad.ok ? tokensLoad.value : [];
  const categories = categoriesLoad.ok ? categoriesLoad.value : [];
  const sales = salesLoad.ok ? salesLoad.value : [];
  const offers = offersLoad.ok ? offersLoad.value : [];

  const featuredCategories = [...categories]
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 6);
  const heroTokens = tokens.slice(0, 3);

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <HeroSection tokens={heroTokens} snapshot={snapshot} freshness={freshness} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TrendingCategoriesSection
            categories={featuredCategories.slice(0, 4)}
            unavailable={!categoriesLoad.ok}
          />
        </div>
        <aside className="lg:col-span-4">
          <MarketInsights snapshot={snapshot} freshness={freshness} />
        </aside>
      </div>

      <MarketActivitySection tokens={tokens} unavailable={!tokensLoad.ok} />

      <SalesOffersSection
        salesUnavailable={!salesLoad.ok}
        offersUnavailable={!offersLoad.ok}
        sales={sales.map((s) => ({
          kind: 'sale' as const,
          tokenId: s.tokenId,
          price: s.price,
          currency: s.currency,
          occurredAt: s.occurredAt,
          orderHash: s.orderHash,
          buyer: s.buyer,
          seller: s.seller,
        }))}
        offers={offers.map((o) => ({
          kind: 'offer' as const,
          tokenId: o.tokenId,
          price: o.price,
          currency: o.currency,
          occurredAt: o.expiresAt ?? Math.floor(Date.now() / 1000),
          orderHash: o.orderHash,
          maker: o.maker,
          expiresAt: o.expiresAt,
        }))}
      />

      <PaymentMethodStrip />
    </div>
  );
}

function HeroSection({
  tokens,
  snapshot,
  freshness,
}: {
  tokens: Awaited<ReturnType<typeof listTokens>>;
  snapshot: Awaited<ReturnType<typeof getCollectionSnapshot>>;
  freshness: Awaited<ReturnType<ReturnType<typeof getMarketSource>['getFreshness']>>;
}) {
  return (
    <section className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10 lg:gap-14">
      <div className="md:col-span-7 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">{snapshot.name}</span>
          <LiveIndicator
            tone={snapshot.marketStatus === 'live' && freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={snapshot.marketStatus === 'live' && freshness.fresh ? 'Live' : 'Syncing'}
          />
        </div>

        <h1 className="text-display text-[clamp(2.75rem,6.5vw,5.25rem)] text-[var(--color-text-primary)]">
          Button Presser
        </h1>

        <p className="text-body max-w-[58ch] text-[var(--color-text-secondary)] md:text-[17px]">
          A cultural icon, now on-chain. Own a piece of NetNet Capital Management history.
          Real numbers. Real brass. Real owners.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/market" className="nv-button">
            Explore collection
            <ArrowRight size={14} weight="bold" />
          </Link>
          <Link href="/categories" className="nv-button nv-button-ghost">
            Browse categories
          </Link>
          <a
            href={`https://opensea.io/assets/robinhood/${snapshot.contractAddress}/1`}
            target="_blank"
            rel="noreferrer"
            className="ml-2 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            View on OpenSea
            <ArrowUpRight size={12} weight="bold" />
          </a>
        </div>

        <CollectionPulse snapshot={snapshot} freshness={freshness} />
      </div>

      <div className="relative md:col-span-5">
        <div className="md:sticky md:top-24">
          <LayeredHeroArt tokens={tokens} />
        </div>
      </div>
    </section>
  );
}

function TrendingCategoriesSection({
  categories,
  unavailable,
}: {
  categories: CategoryMetrics[];
  unavailable?: boolean;
}) {
  return (
    <section className="flex flex-col gap-8">
      <SectionHeader
        eyebrow="Markets"
        title="Trending markets"
        trailing={
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            View all
            <ArrowRight size={12} weight="bold" />
          </Link>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title={unavailable ? 'Categories unavailable' : 'Categories light up once the indexer is warm'}
          body={
            unavailable
              ? 'The category read model could not be loaded. This is not an empty market.'
              : 'Trait categories are computed deterministically from each token\'s number and recompute as live listings arrive.'
          }
          tone="warming"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {categories.map((c) => (
            <CategoryCard key={c.slug} metrics={c} movement={c.floorChange7d} />
          ))}
        </div>
      )}
    </section>
  );
}

function MarketActivitySection({
  tokens,
  unavailable,
}: {
  tokens: Awaited<ReturnType<typeof listTokens>>;
  unavailable?: boolean;
}) {
  return (
    <section className="flex flex-col gap-8">
      <SectionHeader
        eyebrow="Market"
        title="Active listings"
        trailing={
          <Link
            href="/market"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            View all
            <ArrowRight size={12} weight="bold" />
          </Link>
        }
      />

      {tokens.length === 0 ? (
        <EmptyState
          title={unavailable ? 'Listings unavailable' : 'Live listings are warming up'}
          body={
            unavailable
              ? 'The listing read model could not be loaded. This is not proof that nothing is listed.'
              : 'The indexer has not yet surfaced active listings for Button Presser. Pull in a few minutes, or browse categories.'
          }
          tone="warming"
          action={
            <Link href="/categories" className="nv-button nv-button-ghost">
              Browse categories
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {tokens.slice(0, 8).map((t, idx) => (
            <AssetCard key={t.tokenId} token={t} priority={idx < 4} />
          ))}
        </div>
      )}
    </section>
  );
}

function SalesOffersSection({
  sales,
  offers,
  salesUnavailable,
  offersUnavailable,
}: {
  sales: SaleOrOfferEntry[];
  offers: SaleOrOfferEntry[];
  salesUnavailable?: boolean;
  offersUnavailable?: boolean;
}) {
  return (
    <section className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      <SalesOffersList
        title="Recent sales"
        type="sale"
        viewAllHref="/activity"
        entries={sales}
        empty={
          salesUnavailable
            ? 'Sales tape unavailable — not the same as zero trades.'
            : 'No sales have cleared yet. Trades will appear here as soon as the orderbook settles a fill.'
        }
      />
      <SalesOffersList
        title="Open offers"
        type="offer"
        viewAllHref="/activity?type=offer"
        entries={offers}
        empty={
          offersUnavailable
            ? 'Offers unavailable — not the same as an empty book.'
            : 'No open offers right now. Watch a category to be notified when a collector makes a move.'
        }
      />
    </section>
  );
}

function MarketInsights({
  snapshot,
  freshness,
}: {
  snapshot: Awaited<ReturnType<typeof getCollectionSnapshot>>;
  freshness: Awaited<ReturnType<ReturnType<typeof getMarketSource>['getFreshness']>>;
}) {
  const live = snapshot.marketStatus === 'live' && freshness.fresh;
  return (
    <div className="flex h-full flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-display text-xl text-[var(--color-text-primary)]">Market insights</h2>
        <LiveIndicator tone={live ? 'green' : 'amber'} size={6} label={live ? 'Live' : 'Syncing'} />
      </div>
      <dl className="grid grid-cols-2 gap-4">
        {(
          [
            ['Official supply', snapshot.totalSupply.toLocaleString()],
            [live ? 'Listed' : 'Known listed', snapshot.listedCount.toLocaleString()],
            ['Floor', payment(snapshot.floorPrice, snapshot.currency)],
            ['24h volume', payment(snapshot.volume24hNative, 'ETH')],
            ['24h sales', compact(snapshot.sales24h)],
            ['Owners', compact(snapshot.owners)],
            ['Best offer', payment(snapshot.topOfferPrice, snapshot.currency)],
            ['Highest sale', payment(snapshot.topSalePrice, snapshot.currency)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-eyebrow-muted">{label}</dt>
            <dd className="text-numeral text-[15px] font-semibold text-[var(--color-text-primary)]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-eyebrow-muted">{eyebrow}</span>
        <h2 className="text-display text-2xl text-[var(--color-text-primary)] md:text-3xl">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}
