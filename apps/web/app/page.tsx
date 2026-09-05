import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { LayeredHeroArt } from '@/components/ui/LayeredHeroArt';
import { MetricStrip } from '@/components/ui/MetricStrip';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { AssetCard } from '@/components/ui/AssetCard';
import { AssetSkeleton } from '@/components/ui/Skeleton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { listCategories } from '@/lib/data/categories';
import {
  getCollectionSnapshot,
  getRecentOffers,
  getRecentSales,
  listTokens,
} from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import type { CategoryMetrics } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [snapshot, tokens, categories, freshness, sales, offers] = await Promise.all([
    getCollectionSnapshot(),
    listTokens({ listedOnly: true, limit: 8 }),
    listCategories(),
    getMarketSource().getFreshness(),
    getRecentSales(8),
    getRecentOffers(8),
  ]);

  const featuredCategories = categories
    .filter((c) => c.memberSupply > 0)
    .slice(0, 6);
  const heroTokens = tokens.slice(0, 3);

  return (
    <div className="flex flex-col gap-20 md:gap-28">
      <HeroSection tokens={heroTokens} snapshot={snapshot} freshness={freshness} />

      <TrendingCategoriesSection categories={featuredCategories} />

      <MarketActivitySection tokens={tokens} />

      <SalesOffersSection
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
            tone={freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={freshness.fresh ? 'Live' : 'Warming'}
          />
        </div>

        <h1 className="text-display text-[clamp(2.75rem,6.5vw,5rem)] text-[var(--color-text-primary)]">
          The market
          <br />
          for numbers.
        </h1>

        <p className="text-body max-w-[58ch] text-[var(--color-text-secondary)] md:text-[17px]">
          Discover, collect, and trade the most desirable Button Presser characters by number
          pattern. Every active ask on Robinhood Chain, every trait category, in one terminal.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/market" className="nv-button">
            Explore market
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

        <MetricStrip snapshot={snapshot} freshness={freshness} />
      </div>

      <div className="relative md:col-span-5">
        <LayeredHeroArt tokens={tokens} />
      </div>
    </section>
  );
}

function TrendingCategoriesSection({ categories }: { categories: CategoryMetrics[] }) {
  return (
    <section className="flex flex-col gap-8">
      <SectionHeader
        eyebrow="Browse"
        title="Trending categories"
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
          title="Categories light up once the indexer is warm"
          body="Trait categories are computed deterministically from each token's number and recompute as live listings arrive."
          tone="warming"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.slug} metrics={c} movement={null} />
          ))}
        </div>
      )}
    </section>
  );
}

function MarketActivitySection({
  tokens,
}: {
  tokens: Awaited<ReturnType<typeof listTokens>>;
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
          title="Live listings are warming up"
          body="The OpenSea indexer has not yet surfaced active listings for Button Presser. Pull in a few minutes, or browse categories to discover trait combinations."
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
}: {
  sales: SaleOrOfferEntry[];
  offers: SaleOrOfferEntry[];
}) {
  return (
    <section className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      <SalesOffersList
        title="Recent sales"
        type="sale"
        viewAllHref="/activity"
        entries={sales}
        empty="No sales have cleared yet. Trades will appear here as soon as the orderbook settles a fill."
      />
      <SalesOffersList
        title="Open offers"
        type="offer"
        viewAllHref="/activity?type=offer"
        entries={offers}
        empty="No open offers right now. Watch a category to be notified when a collector makes a move."
      />
    </section>
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
