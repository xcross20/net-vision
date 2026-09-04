import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryMetrics, listCategoryTokens } from '@/lib/data/categories';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { TokenCard } from '@/components/TokenCard';
import { TradingGateBanner } from '@/components/TradingGateBanner';
import { formatPrice, formatPercent } from '@net-vision/ui';

export function generateStaticParams() {
  return VIRTUAL_COLLECTION_CATALOG.map((c) => ({ slug: c.slug }));
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metrics = getCategoryMetrics(slug);
  if (!metrics) {
    notFound();
  }
  const tokens = listCategoryTokens(slug);
  const listedPct =
    metrics.memberSupply > 0 ? metrics.listedCount / metrics.memberSupply : 0;

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-[var(--nv-muted)]">
        <Link href="/categories" className="nv-link">Categories</Link>
        <span className="mx-2">/</span>
        <span>{metrics.name}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="nv-chip nv-chip-strong">{metrics.family}</span>
          <span className="nv-chip nv-mono">{metrics.slug}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold">{metrics.name}</h1>
        <p className="text-[var(--nv-muted)] max-w-2xl">{metrics.description}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 nv-panel p-4">
        <div className="nv-stat">
          <span className="nv-stat-label">Members</span>
          <span className="nv-stat-value nv-mono">{metrics.memberSupply}</span>
        </div>
        <div className="nv-stat">
          <span className="nv-stat-label">Listed</span>
          <span className="nv-stat-value nv-mono">{metrics.listedCount}</span>
        </div>
        <div className="nv-stat">
          <span className="nv-stat-label">Listed %</span>
          <span className="nv-stat-value nv-mono">{formatPercent(listedPct)}</span>
        </div>
        <div className="nv-stat">
          <span className="nv-stat-label">Floor</span>
          <span className="nv-stat-value nv-stat-value-strong nv-mono">
            {formatPrice(metrics.floorPriceEth)}
          </span>
        </div>
        <div className="nv-stat">
          <span className="nv-stat-label">Volume (seed)</span>
          <span className="nv-stat-value nv-mono">
            {formatPrice(metrics.volume24hEth)}
          </span>
        </div>
      </section>

      <TradingGateBanner context="category" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Members</h2>
        {tokens.length === 0 ? (
          <div className="nv-panel p-6 text-center text-[var(--nv-muted)]">
            No tokens in the indexed seed match this category yet.
          </div>
        ) : (
          <div className="nv-grid">
            {tokens.map((t) => (
              <TokenCard key={t.tokenId} token={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
