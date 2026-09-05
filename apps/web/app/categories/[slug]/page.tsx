import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { getCategoryMetrics, listCategoryTokens } from '@/lib/data/categories';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { AssetCard } from '@/components/ui/AssetCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { compact, payment } from '@/lib/format';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return VIRTUAL_COLLECTION_CATALOG.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  return {
    title: meta ? `${meta.name} — Net Vision` : 'Category — Net Vision',
    description: meta?.description ?? 'Button Presser category on Robinhood Chain.',
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [metrics, tokens, freshness] = await Promise.all([
    getCategoryMetrics(slug),
    listCategoryTokens(slug),
    getMarketSource().getFreshness(),
  ]);
  if (!metrics) {
    notFound();
  }
  const listedPct =
    metrics.memberSupply > 0 ? (metrics.listedCount / metrics.memberSupply) * 100 : 0;

  return (
    <div className="flex flex-col gap-12">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link href="/categories" className="transition-colors hover:text-[var(--color-text-primary)]">
          Categories
        </Link>
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <span className="text-[var(--color-text-primary)]">{metrics.name}</span>
      </nav>

      <header className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="text-eyebrow">{metrics.family}</span>
          <LiveIndicator
            tone={freshness.fresh ? 'green' : 'amber'}
            size={6}
            label={freshness.fresh ? 'Live' : 'Warming'}
          />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-7 flex flex-col gap-4">
            <h1 className="text-display text-[clamp(2.5rem,5.5vw,4.25rem)] text-[var(--color-text-primary)]">
              {metrics.name}
            </h1>
            <p className="text-body max-w-[58ch] text-[var(--color-text-secondary)] md:text-[17px]">
              {metrics.description}
            </p>
          </div>
          <div className="md:col-span-5 flex flex-col gap-4">
            <span className="text-eyebrow-muted">Collection pulse</span>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[var(--color-border-subtle)] py-6 md:grid-cols-2">
              <Stat label="Floor" value={payment(metrics.floorPrice, metrics.currency)} emphasis />
              <Stat label="Listed" value={metrics.listedCount.toLocaleString()} sub={`${listedPct.toFixed(1)}% of members`} />
              <Stat label="Owners" value={metrics.owners.toLocaleString()} />
              <Stat label="Vol 24h" value={payment(metrics.volume24hNative, 'ETH')} sub={`${metrics.sales24h.toLocaleString()} sales`} />
            </div>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-eyebrow-muted">Listings</span>
            <h2 className="text-display text-2xl text-[var(--color-text-primary)] md:text-3xl">
              Active in this category
            </h2>
          </div>
          <Link
            href="/market"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-net-green)]"
          >
            Open market
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        {tokens.length === 0 ? (
          <EmptyState
            title="No live listings for this category"
            body={
              metrics.memberSupply > 0
                ? `${metrics.memberSupply.toLocaleString()} tokens belong to this category, but none are currently listed on the OpenSea orderbook.`
                : 'No tokens have been classified into this category yet.'
            }
            tone="muted"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 xl:grid-cols-4">
            {tokens.slice(0, 12).map((t, idx) => (
              <AssetCard key={t.tokenId} token={t} priority={idx < 4} />
            ))}
          </div>
        )}
      </section>

      <Link
        href="/market"
        className="nv-button nv-button-ghost self-start"
      >
        All listings
        <ArrowUpRight size={12} weight="bold" />
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow-muted">{label}</span>
      <span
        className={
          emphasis
            ? 'text-numeral text-xl font-semibold tracking-tight text-[var(--color-net-green)] md:text-2xl'
            : 'text-numeral text-xl font-semibold tracking-tight text-[var(--color-text-primary)] md:text-2xl'
        }
      >
        {value}
      </span>
      {sub ? <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">{sub}</span> : null}
    </div>
  );
}
