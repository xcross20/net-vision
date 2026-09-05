import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryMetrics, listCategoryTokens } from '@/lib/data/categories';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { TokenCard } from '@/components/TokenCard';
import { TokenRow } from '@/components/TokenRow';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { getMarketSource } from '@/lib/market';
import type { Token } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';
import { ArrowR } from '@/components/icons';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return VIRTUAL_COLLECTION_CATALOG.map((c) => ({ slug: c.slug }));
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
    metrics.memberSupply > 0 ? metrics.listedCount / metrics.memberSupply : 0;

  return (
    <div className="flex flex-col gap-8">
      <nav className="text-sm text-[var(--nv-muted)]">
        <Link href="/categories" className="transition-colors hover:text-[var(--nv-text)]">
          Categories
        </Link>
        <span className="mx-2 text-[var(--nv-muted-dim)]">/</span>
        <span className="text-[var(--nv-text)]">{metrics.name}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="nv-eyebrow">{metrics.family}</span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="nv-display text-4xl md:text-5xl">{metrics.name}</h1>
        <p className="nv-body">{metrics.description}</p>
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--nv-border)] py-6 md:grid-cols-5">
        <Stat label="Members" value={metrics.memberSupply.toLocaleString()} />
        <Stat label="Listed" value={metrics.listedCount.toLocaleString()} />
        <Stat label="Listed %" value={`${(listedPct * 100).toFixed(1)}%`} />
        <Stat label="Floor" value={formatPrice(metrics.floorPriceEth)} accent />
        <Stat label="Owners" value={metrics.owners.toLocaleString()} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="nv-display text-2xl md:text-3xl">Active listings</h2>
          <span className="nv-label">{tokens.length} live</span>
        </div>
        {tokens.length === 0 ? (
          <div className="nv-panel-soft flex flex-col gap-2 p-6 md:p-8">
            <span className="text-base font-semibold tracking-tight text-[var(--nv-text)]">
              No live listings for this category right now
            </span>
            <p className="text-sm leading-relaxed text-[var(--nv-muted)]">
              {metrics.memberSupply > 0
                ? `${metrics.memberSupply.toLocaleString()} tokens belong to this category, but none are currently listed on the OpenSea orderbook.`
                : 'No tokens have been classified into this category yet.'}
            </p>
          </div>
        ) : (
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
        )}
      </section>

      <Link
        href="/market"
        className="nv-button nv-button-ghost self-start"
      >
        All listings
        <ArrowR size={14} weight="bold" />
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="nv-stat-label">{label}</span>
      <span className={accent ? 'nv-stat-value nv-stat-value-strong' : 'nv-stat-value'}>
        {value}
      </span>
    </div>
  );
}