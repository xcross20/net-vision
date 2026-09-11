import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ChartLine, Cube, ListBullets, Tag, Users } from '@phosphor-icons/react/dist/ssr';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { AssetCard } from '@/components/ui/AssetCard';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaymentMethodStrip } from '@/components/commerce/PaymentMethodStrip';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
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
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
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
    .slice(0, 4);
  const live = snapshot.marketStatus === 'live' && freshness.fresh;
  const listedLabel = snapshot.marketStatus === 'syncing' ? 'Known listed' : 'Listed';

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <CinematicHero
        imageSrc={SHOWROOM_MEDIA.homepageHero}
        imageAlt="Cinematic Button Presser plaques staged in a showroom environment"
        eyebrow="Numbers today. More tomorrow."
        title="Button Presser"
        kicker="A cultural icon, now on-chain."
        body="Own a piece of NetNet Capital Management history. Real numbers. Real brass. Real owners."
        priority
        actions={
          <>
            <Link href="/market" className="nv-button">
              Explore collection
              <ArrowRight size={14} weight="bold" />
            </Link>
            <Link href="/categories" className="nv-button nv-button-ghost">
              Browse categories
            </Link>
          </>
        }
        aside={
          <ShowroomAside
            lines={['Same numbers.', 'Bigger', 'possibilities.']}
          />
        }
        metrics={[
          {
            label: 'Items',
            value: compact(snapshot.totalSupply),
            icon: <Cube size={16} weight="duotone" />,
          },
          {
            label: 'Floor',
            value: payment(snapshot.floorPrice, snapshot.currency),
            icon: <Tag size={16} weight="duotone" />,
            emphasis: true,
          },
          {
            label: '24h volume',
            value: payment(snapshot.volume24hNative, 'ETH'),
            icon: <ChartLine size={16} weight="duotone" />,
          },
          {
            label: listedLabel,
            value: snapshot.listedCount.toLocaleString(),
            icon: <ListBullets size={16} weight="duotone" />,
          },
          {
            label: 'Owners',
            value: compact(snapshot.owners),
            icon: <Users size={16} weight="duotone" />,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TrendingCategoriesSection
            categories={featuredCategories}
            unavailable={!categoriesLoad.ok}
          />
        </div>
        <aside className="flex flex-col gap-6 lg:col-span-4">
          <MarketInsights snapshot={snapshot} live={live} />
          <AtmosphereCard />
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

function AtmosphereCard() {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--color-border-subtle)]">
      <Image
        src={SHOWROOM_MEDIA.brandCrate}
        alt=""
        width={1200}
        height={675}
        className="h-48 w-full object-cover md:h-56"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(5,9,8,0.92)] via-[rgba(5,9,8,0.35)] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
        <span className="text-eyebrow">Showroom</span>
        <p className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Same numbers. Bigger possibilities.
        </p>
        <p className="text-[12px] text-[var(--color-text-secondary)]">
          Atmospheric brand photography. Not live inventory.
        </p>
      </div>
    </div>
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
    <section className="flex flex-col gap-6">
      <SectionHeader
        title="Trending markets"
        subtitle="Live categories ranked by activity, not mock volume."
        trailing={
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            View all markets
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
          {categories.map((c, index) => (
            <CategoryCard key={c.slug} metrics={c} movement={c.floorChange7d} rank={index + 1} />
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
    <section className="flex flex-col gap-6">
      <SectionHeader
        title="Featured live listings"
        subtitle="Canonical on-chain media. Live asks only."
        trailing={
          <Link
            href="/market"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            View all listings
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-5">
          {tokens.slice(0, 5).map((t, idx) => (
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
            ? 'Sales tape unavailable - not the same as zero trades.'
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
            ? 'Offers unavailable - not the same as an empty book.'
            : 'No open offers right now. Watch a category to be notified when a collector makes a move.'
        }
      />
    </section>
  );
}

function MarketInsights({
  snapshot,
  live,
}: {
  snapshot: Awaited<ReturnType<typeof getCollectionSnapshot>>;
  live: boolean;
}) {
  return (
    <div className="nv-glass flex h-full flex-col gap-5 rounded-[20px] p-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-display text-xl text-[var(--color-text-primary)]">Market insights</h2>
          <span className="text-[12px] text-[var(--color-text-tertiary)]">Live market data</span>
        </div>
        <LiveIndicator tone={live ? 'green' : 'amber'} size={6} label={live ? 'Live' : 'Syncing'} />
      </div>
      <dl className="grid grid-cols-2 gap-3">
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
          <div
            key={label}
            className="flex flex-col gap-1 rounded-[14px] border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.35)] px-3 py-3"
          >
            <dt className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</dt>
            <dd className="text-numeral text-[15px] font-semibold text-[var(--color-text-primary)]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-display text-2xl text-[var(--color-text-primary)] md:text-[1.75rem]">{title}</h2>
        {subtitle ? <p className="text-[13px] text-[var(--color-text-tertiary)]">{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  );
}
