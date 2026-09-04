import Link from 'next/link';
import { listCategories } from '@/lib/data/categories';
import { getCollectionSnapshot, listTokens } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import type { CategoryMetrics, Token } from '@/lib/market';
import { TokenCard } from '@/components/TokenCard';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { formatPrice } from '@net-vision/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const snapshot = await getCollectionSnapshot();
  const tokens = await listTokens({ listedOnly: true, limit: 24 });
  const categories = (await listCategories()).filter((c) => c.memberSupply > 0).slice(0, 6);
  const freshness = await getMarketSource().getFreshness();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="text-[var(--nv-green)] text-xs uppercase tracking-[0.18em]">
            {snapshot.name}
          </span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          The market for numbers.
        </h1>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/market" className="nv-button">
            Explore market
          </Link>
          <Link href="/categories" className="nv-button nv-button-ghost">
            Categories
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-[var(--nv-border)]">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Listed</span>
            <span className="text-2xl md:text-3xl font-semibold nv-mono">
              {snapshot.listedCount.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Floor</span>
            <span className="text-2xl md:text-3xl font-semibold nv-mono">
              {formatPrice(snapshot.floorPriceEth)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Volume 24h</span>
            <span className="text-2xl md:text-3xl font-semibold nv-mono">
              {formatPrice(snapshot.volume24hEth)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Sales 24h</span>
            <span className="text-2xl md:text-3xl font-semibold nv-mono">
              {snapshot.sales24h.toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--nv-muted)]">
            Trending categories
          </h2>
          <Link href="/categories" className="text-sm text-[var(--nv-green)] hover:underline">
            All categories →
          </Link>
        </div>
        <div className="flex flex-col">
          {categories.map((c) => (
            <CategoryRow key={c.slug} metrics={c} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--nv-muted)]">
            Market activity
          </h2>
          <Link href="/market" className="text-sm text-[var(--nv-green)] hover:underline">
            All listings →
          </Link>
        </div>
        {tokens.length === 0 ? (
          <div className="nv-panel p-6 text-sm text-[var(--nv-muted)]">
            Live listings are unavailable while the OpenSea indexer warms up.
          </div>
        ) : (
          <div className="nv-grid">
            {tokens.slice(0, 12).map((t: Token) => (
              <TokenCard key={t.tokenId} token={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryRow({ metrics }: { metrics: CategoryMetrics }) {
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className="grid grid-cols-12 gap-4 items-center py-3 border-b border-[var(--nv-border)] hover:bg-[var(--nv-panel-elevated)] transition-colors"
    >
      <div className="col-span-1 text-[var(--nv-muted)] text-sm">★</div>
      <div className="col-span-5">
        <div className="font-medium">{metrics.name}</div>
        <div className="text-xs text-[var(--nv-muted)]">{metrics.description}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Floor</div>
        <div className="text-sm nv-mono">{formatPrice(metrics.floorPriceEth)}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Listed</div>
        <div className="text-sm nv-mono">{metrics.listedCount.toLocaleString()}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">Owners</div>
        <div className="text-sm nv-mono">{metrics.owners.toLocaleString()}</div>
      </div>
    </Link>
  );
}
