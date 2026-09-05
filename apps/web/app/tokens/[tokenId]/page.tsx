import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { getToken, getRecentSales } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { TokenCommercePanel } from '@/components/TokenCommercePanel';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { address, payment, relative } from '@/lib/format';
import { ArrowR } from '@/components/icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  return {
    title: `Button Presser #${tokenId} — Net Vision`,
    description: `Live orderbook data, traits, and trade history for Button Presser #${tokenId}.`,
  };
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const [token, sales, freshness] = await Promise.all([
    getToken(tokenId),
    getRecentSales(8),
    getMarketSource().getFreshness(),
  ]);
  if (!token) {
    notFound();
  }
  const ask = token.listingPrice;
  const lastSale = token.lastSalePrice;
  const traits = token.traits.filter((t) => t.family !== 'digits');
  const topCategory = traits[0];

  const saleEntries: SaleOrOfferEntry[] = sales
    .filter((s) => s.tokenId === token.tokenId)
    .map((s) => ({
      kind: 'sale' as const,
      tokenId: s.tokenId,
      price: s.price,
      currency: s.currency,
      occurredAt: s.occurredAt,
      orderHash: s.orderHash,
      buyer: s.buyer,
      seller: s.seller,
    }));

  return (
    <div className="flex flex-col gap-12">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link href="/market" className="transition-colors hover:text-[var(--color-text-primary)]">
          Market
        </Link>
        {topCategory ? (
          <>
            <span className="text-[var(--color-text-tertiary)]">/</span>
            <Link
              href={`/categories/${topCategory.slug}`}
              className="transition-colors hover:text-[var(--color-text-primary)]"
            >
              {topCategory.label}
            </Link>
          </>
        ) : null}
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <span className="text-numeral text-[var(--color-text-primary)]">#{token.tokenId}</span>
      </nav>

      <section className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-7">
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]">
            <div className="relative aspect-square bg-[var(--color-surface-2)]">
              <Image
                src={token.imageUrl}
                alt={`Button Presser #${token.tokenId}`}
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-7 md:col-span-5">
          <div className="flex items-center gap-3">
            <span className="text-eyebrow">Button Presser</span>
            <LiveIndicator
              tone={freshness.fresh ? 'green' : 'amber'}
              size={6}
              label={freshness.fresh ? 'Live' : 'Warming'}
            />
          </div>
          <h1 className="text-numeral text-display text-[clamp(3rem,7vw,4.5rem)] text-[var(--color-text-primary)]">
            #{token.tokenId}
          </h1>

          {traits.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {traits.slice(0, 4).map((t) => (
                <Link
                  key={t.slug}
                  href={`/categories/${t.slug}`}
                  className="nv-chip transition-colors hover:border-[var(--color-border-active)]"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          ) : null}

          <dl className="flex flex-col gap-3 border-y border-[var(--color-border-subtle)] py-4">
            <Field label="Best ask">
              <span className="text-numeral text-base font-semibold tracking-tight text-[var(--color-net-green)]">
                {payment(ask, token.currency)}
              </span>
            </Field>
            <Field label="Last sale">
              <span className="text-numeral text-base tracking-tight text-[var(--color-text-primary)]">
                {payment(lastSale, token.currency)}
              </span>
            </Field>
            <Field label="Owner">
              <span className="text-numeral text-xs text-[var(--color-text-secondary)]">
                {token.ownerAddress ? address(token.ownerAddress) : '—'}
              </span>
            </Field>
            <Field label="Listed">
              <span className="text-numeral text-xs text-[var(--color-text-secondary)]">
                {token.listedAt ? relative(token.listedAt) : '—'}
              </span>
            </Field>
            <Field label="Rarity">
              <span className="text-numeral text-xs text-[var(--color-text-secondary)]">
                {token.rarityRank !== null ? `#${token.rarityRank.toLocaleString()}` : 'Unranked'}
              </span>
            </Field>
          </dl>

          <TokenCommercePanel
            tokenId={token.tokenId}
            imageUrl={token.imageUrl}
            ask={ask}
            lastSale={lastSale}
            openseaUrl={`https://opensea.io/assets/robinhood/${token.contractAddress}/${token.tokenId}`}
          />

          <a
            href={`https://opensea.io/assets/robinhood/${token.contractAddress}/${token.tokenId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            View on OpenSea
            <ArrowUpRight size={11} weight="bold" />
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col gap-4">
          <span className="text-eyebrow-muted">All traits</span>
          <div className="flex flex-wrap gap-2">
            {token.traits.map((t) => (
              <Link
                key={t.slug}
                href={`/categories/${t.slug}`}
                className="nv-chip transition-colors hover:border-[var(--color-border-active)]"
              >
                {t.label}
                <span className="text-eyebrow-muted">{t.family}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          {saleEntries.length === 0 ? (
            <EmptyState
              title="No trade history for this token"
              body="Trades will appear here once this specific token has cleared through the OpenSea orderbook."
              tone="muted"
            />
          ) : (
            <SalesOffersList
              title="Sales history"
              type="sale"
              entries={saleEntries}
              empty=""
            />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <span className="text-eyebrow-muted">Contract</span>
        <div className="flex flex-col gap-1 border-t border-[var(--color-border-subtle)] pt-4">
          <span className="text-numeral text-xs text-[var(--color-text-secondary)]">{token.contractAddress}</span>
          <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">
            Chain ID {token.chainId} · ERC-721
          </span>
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
    <div className="flex items-center justify-between gap-3">
      <dt className="text-eyebrow-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
