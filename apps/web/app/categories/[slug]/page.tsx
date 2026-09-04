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
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-[var(--nv-muted)]">
        <Link href="/categories" className="hover:text-[var(--nv-text)]">
          Categories
        </Link>
        <span className="mx-2">/</span>
        <span>{metrics.name}</span>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[var(--nv-green)] text-xs uppercase tracking-[0.18em]">
            {metrics.family}
          </span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{metrics.name}</h1>
        <p className="text-[var(--nv-muted)] max-w-2xl">{metrics.description}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-6 border-y border-[var(--nv-border)] py-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Members</span>
          <span className="text-2xl font-semibold nv-mono">{metrics.memberSupply}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Listed</span>
          <span className="text-2xl font-semibold nv-mono">{metrics.listedCount}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Listed %</span>
          <span className="text-2xl font-semibold nv-mono">{(listedPct * 100).toFixed(1)}%</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Floor</span>
          <span className="text-2xl font-semibold nv-mono">
            {formatPrice(metrics.floorPriceEth)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Owners</span>
          <span className="text-2xl font-semibold nv-mono">
            {metrics.owners.toLocaleString()}
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--nv-muted)]">
          Active listings
        </h2>
        {tokens.length === 0 ? (
          <div className="nv-panel p-6 text-sm text-[var(--nv-muted)]">
            No live listings for this category right now.
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
}
