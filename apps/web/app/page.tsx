import Link from 'next/link';
import { listCategories } from '@/lib/data/categories';
import { getCollectionMetadata, getSeededTokens } from '@/lib/data/seed';
import { CategoryCard } from '@/components/CategoryCard';
import { TokenCard } from '@/components/TokenCard';
import { TradingGateBanner } from '@/components/TradingGateBanner';
import { formatPrice } from '@net-vision/ui';

export default function HomePage() {
  const collection = getCollectionMetadata();
  const tokens = getSeededTokens();
  const listed = tokens.filter((t) => t.listingPriceEth !== null);
  const floors = listed
    .map((t) => (t.listingPriceEth ? Number.parseFloat(t.listingPriceEth) : null))
    .filter((n): n is number => n !== null);
  const collectionFloor = floors.length > 0 ? Math.min(...floors) : null;
  const featuredCategories = listCategories()
    .filter((c) => c.memberSupply > 0)
    .slice(0, 6);
  const newest = tokens.slice(-12).reverse();

  return (
    <div className="flex flex-col gap-8">
      <section className="nv-panel p-6 md:p-8 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="nv-chip nv-chip-strong">Read-only slice</span>
          <span className="nv-chip">{collection.name}</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          The market terminal for collectible numbers.
        </h1>
        <p className="text-[var(--nv-muted)] max-w-2xl">
          Net Vision transforms one Button Presser collection into many algorithmic virtual
          markets. Browse by number pattern, compare structural rarity, and explore floors
          across every category.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/categories" className="nv-button">Browse categories</Link>
          <Link href="/tokens" className="nv-button nv-button-ghost">Explore all tokens</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-[var(--nv-border)]">
          <div className="nv-stat">
            <span className="nv-stat-label">Collection floor</span>
            <span className="nv-stat-value nv-stat-value-strong nv-mono">
              {formatPrice(collectionFloor)}
            </span>
          </div>
          <div className="nv-stat">
            <span className="nv-stat-label">Indexed supply (seed)</span>
            <span className="nv-stat-value nv-mono">{tokens.length}</span>
          </div>
          <div className="nv-stat">
            <span className="nv-stat-label">Categories</span>
            <span className="nv-stat-value nv-mono">{featuredCategories.length}+</span>
          </div>
          <div className="nv-stat">
            <span className="nv-stat-label">Listed</span>
            <span className="nv-stat-value nv-mono">{listed.length}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Featured categories</h2>
          <Link href="/categories" className="nv-link text-sm">View all →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {featuredCategories.map((c) => (
            <CategoryCard key={c.slug} metrics={c} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Newest in seed</h2>
          <Link href="/tokens" className="nv-link text-sm">View all →</Link>
        </div>
        <div className="nv-grid">
          {newest.map((t) => (
            <TokenCard key={t.tokenId} token={t} />
          ))}
        </div>
      </section>

      <TradingGateBanner context="category" />
    </div>
  );
}
