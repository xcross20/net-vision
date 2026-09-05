import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getToken } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { TokenCommercePanel } from '@/components/TokenCommercePanel';
import { ArrowR } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const [token, , , freshness] = await Promise.all([
    getToken(tokenId),
    getMarketSource().getToken(tokenId).then(() => null).catch(() => null),
    Promise.resolve(null),
    getMarketSource().getFreshness(),
  ]);
  if (!token) {
    notFound();
  }
  const ask = token.listingPriceEth ? Number.parseFloat(token.listingPriceEth) : null;
  const lastSale = token.lastSalePriceEth ? Number.parseFloat(token.lastSalePriceEth) : null;
  const categoryTraits = token.traits.filter((t) => t.family !== 'digits');
  const topCategory = categoryTraits[0];

  return (
    <div className="flex flex-col gap-10">
      <nav className="flex items-center gap-2 text-sm text-[var(--nv-muted)]">
        <Link href="/market" className="transition-colors hover:text-[var(--nv-text)]">
          Market
        </Link>
        <span className="text-[var(--nv-muted-dim)]">/</span>
        {topCategory ? (
          <>
            <Link
              href={`/categories/${topCategory.slug}`}
              className="transition-colors hover:text-[var(--nv-text)]"
            >
              {topCategory.label}
            </Link>
            <span className="text-[var(--nv-muted-dim)]">/</span>
          </>
        ) : null}
        <span className="nv-mono text-[var(--nv-text)]">#{token.tokenId}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="nv-eyebrow">Button Presser</span>
          <DataFreshnessBadge freshness={freshness} />
        </div>
        <h1 className="nv-numeral nv-display text-5xl md:text-6xl">#{token.tokenId}</h1>
      </div>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="nv-panel overflow-hidden">
          <div className="aspect-square bg-[var(--nv-panel-elevated)]">
            <img
              src={token.imageUrl}
              alt={`Button Presser #${token.tokenId}`}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {categoryTraits.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {categoryTraits.slice(0, 3).map((t) => (
                <Link
                  key={t.slug}
                  href={`/categories/${t.slug}`}
                  className="nv-chip transition-colors hover:border-[var(--nv-green)]"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          ) : null}

          <dl className="nv-panel-soft divide-y divide-[var(--nv-border)] p-4">
            <Field label="Owner">
              <span className="nv-mono text-xs">
                {token.ownerAddress ? shortenAddress(token.ownerAddress) : '—'}
              </span>
            </Field>
            <Field label="Rarity">
              {token.rarityRank !== null ? `#${token.rarityRank.toLocaleString()}` : '—'}
            </Field>
            <Field label="Standard">
              <span className="nv-mono text-xs">ERC-721</span>
            </Field>
          </dl>

          <TokenCommercePanel
            tokenId={token.tokenId}
            imageUrl={token.imageUrl}
            ask={ask}
            lastSale={lastSale}
            openseaUrl={`https://opensea.io/assets/robinhood/${token.contractAddress}/${token.tokenId}`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <span className="nv-eyebrow-muted">All traits</span>
        <div className="flex flex-wrap gap-2">
          {token.traits.map((t) => (
            <span key={t.slug} className="nv-chip" title={`Family: ${t.family}`}>
              {t.label}
            </span>
          ))}
        </div>
      </section>

      {categoryTraits.length > 0 ? (
        <section className="flex flex-col gap-3">
          <span className="nv-eyebrow-muted">In categories</span>
          <div className="flex flex-wrap gap-2">
            {categoryTraits.map((t) => (
              <Link
                key={t.slug}
                href={`/categories/${t.slug}`}
                className="nv-chip transition-colors hover:border-[var(--nv-green)]"
              >
                {t.label}
                <ArrowR size={11} weight="bold" className="ml-1 text-[var(--nv-green)]" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <span className="nv-eyebrow-muted">Contract</span>
        <div className="nv-panel-soft p-4 text-xs">
          <div className="nv-mono text-[var(--nv-text-soft)]">{token.contractAddress}</div>
          <div className="nv-mono mt-2 text-[var(--nv-muted)]">Chain ID {token.chainId}</div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <dt className="nv-label">{label}</dt>
      <dd className="text-[var(--nv-text-soft)]">{children}</dd>
    </div>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}