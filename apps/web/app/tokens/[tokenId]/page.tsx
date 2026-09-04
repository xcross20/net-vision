import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getToken } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';

export const dynamic = 'force-dynamic';

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const [token, bestListing, bestOffer, freshness] = await Promise.all([
    getToken(tokenId),
    getMarketSource().getToken(tokenId).then(async () => {
      try {
        return null;
      } catch {
        return null;
      }
    }),
    Promise.resolve(null),
    getMarketSource().getFreshness(),
  ]);
  if (!token) {
    notFound();
  }
  const ask = token.listingPriceEth ? Number.parseFloat(token.listingPriceEth) : null;
  const lastSale = token.lastSalePriceEth ? Number.parseFloat(token.lastSalePriceEth) : null;

  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-[var(--nv-muted)]">
        <Link href="/market" className="hover:text-[var(--nv-text)]">
          Market
        </Link>
        <span className="mx-2">/</span>
        <span>#{token.tokenId}</span>
      </nav>

      <div className="flex items-center gap-3">
        <span className="text-[var(--nv-green)] text-xs uppercase tracking-[0.18em]">
          Button Presser
        </span>
        <DataFreshnessBadge freshness={freshness} />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="nv-panel overflow-hidden">
          <div className="aspect-square bg-[var(--nv-panel-elevated)] flex items-center justify-center">
            <img
              src={token.imageUrl}
              alt={`Button Presser #${token.tokenId}`}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wider text-[var(--nv-muted)]">
              {token.traits
                .filter((t) => t.family !== 'digits')
                .slice(0, 3)
                .map((t) => t.label)
                .join(' · ') || 'Button Presser'}
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight nv-numeral">
              #{token.tokenId}
            </h1>
          </div>

          <div className="flex flex-col gap-3 border-t border-b border-[var(--nv-border)] py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Best ask</span>
              <span className="text-2xl font-semibold nv-mono">{formatPrice(ask)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Last sale</span>
              <span className="text-sm nv-mono">{formatPrice(lastSale)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Owner</span>
              <span className="text-xs nv-mono">
                {token.ownerAddress ? shortenAddress(token.ownerAddress) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--nv-muted)]">Rarity</span>
              <span className="text-xs nv-mono">
                {token.rarityRank !== null ? `#${token.rarityRank.toLocaleString()}` : '—'}
              </span>
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

          <a
            href={`https://opensea.io/assets/robinhood/${token.contractAddress}/${token.tokenId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--nv-muted)] hover:text-[var(--nv-text)]"
          >
            View on OpenSea ↗
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--nv-muted)]">Traits</h2>
        <div className="flex flex-wrap gap-2">
          {token.traits.map((t) => (
            <span
              key={t.slug}
              className="nv-chip"
              title={`Family: ${t.family}`}
            >
              {t.label}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--nv-muted)]">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {token.traits
            .filter((t) => t.family !== 'digits')
            .map((t) => (
              <Link
                key={t.slug}
                href={`/categories/${t.slug}`}
                className="nv-chip hover:border-[var(--nv-green)]"
              >
                {t.label}
              </Link>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--nv-muted)]">Contract</h2>
        <div className="nv-panel p-4 text-xs nv-mono text-[var(--nv-muted)]">
          {token.contractAddress}
          <br />
          Chain ID: {token.chainId}
        </div>
      </section>
    </div>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
