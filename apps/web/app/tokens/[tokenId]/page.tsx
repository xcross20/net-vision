import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSeededToken } from '@/lib/data/seed';
import { TradingGateBanner } from '@/components/TradingGateBanner';
import { formatPrice } from '@net-vision/ui';
import { getCollectionMetadata } from '@/lib/data/seed';

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const token = getSeededToken(tokenId);
  if (!token) {
    notFound();
  }
  const collection = getCollectionMetadata();
  const ask = token.listingPriceEth ? Number.parseFloat(token.listingPriceEth) : null;
  const lastSale = token.lastSalePriceEth
    ? Number.parseFloat(token.lastSalePriceEth)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-[var(--nv-muted)]">
        <Link href="/tokens" className="nv-link">Tokens</Link>
        <span className="mx-2">/</span>
        <span>#{token.tokenId}</span>
      </nav>

      {/* Above-the-fold mobile commerce surface per the start prompt */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="nv-panel overflow-hidden">
          <div className="aspect-square bg-[var(--nv-panel-elevated)] flex items-center justify-center">
            <img
              src={token.imageUrl}
              alt={`Button Presser #${token.tokenId}`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="nv-section-title">{collection.name}</span>
            <h1 className="text-3xl md:text-4xl font-semibold nv-numeral">
              #{token.tokenId}
            </h1>
          </div>

          <div className="nv-panel p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Current ask</span>
              <span className="text-2xl font-semibold nv-stat-value-strong nv-mono">
                {formatPrice(ask)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Last sale</span>
              <span className="text-sm nv-mono">{formatPrice(lastSale)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Owner</span>
              <span className="text-xs nv-mono">{shortenAddress(token.ownerAddress)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="nv-button nv-button-disabled"
              disabled
              aria-disabled="true"
            >
              Buy now
            </button>
            <button
              type="button"
              className="nv-button nv-button-ghost nv-button-disabled"
              disabled
              aria-disabled="true"
            >
              Make offer
            </button>
            <button
              type="button"
              className="nv-button nv-button-ghost nv-button-disabled"
              disabled
              aria-disabled="true"
            >
              Add to cart
            </button>
          </div>
        </div>
      </section>

      <TradingGateBanner context="token" />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Traits</h2>
        <div className="flex flex-wrap gap-2">
          {token.traits.map((t) => (
            <span key={t.slug} className="nv-chip nv-chip-strong" title={`Family: ${t.family}`}>
              {t.label}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {token.traits
            .filter((t) => t.family !== 'digits')
            .map((t) => (
              <Link key={t.slug} href={`/categories/${t.slug}`} className="nv-chip nv-link">
                {t.label} →
              </Link>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Contract</h2>
        <div className="nv-panel p-4 text-xs nv-mono text-[var(--nv-muted)]">
          {collection.contractAddress}
          <br />
          Standard: {collection.tokenStandard}
        </div>
      </section>
    </div>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
