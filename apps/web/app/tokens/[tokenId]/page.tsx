import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Heart, ShareNetwork } from '@phosphor-icons/react/dist/ssr';
import { getToken, getTokenOffers, getTokenSales, listTokens } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { BUTTON_PRESSER_COLLECTION, CHAIN_DISPLAY } from '@net-vision/chain-config';
import { OfferActions } from '@/components/OfferActions';
import { OffersPanel } from '@/components/offers/OffersPanel';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { TokenCommercePanel } from '@/components/TokenCommercePanel';
import { SalesOffersList, type SaleOrOfferEntry } from '@/components/ui/SalesOffersList';
import { EmptyState } from '@/components/ui/EmptyState';
import { AssetCard } from '@/components/ui/AssetCard';
import { SHOWROOM_MEDIA, showroomHeroForCategory } from '@/lib/brand/media';
import { isProxyImageUrl } from '@/lib/data/media';
import { address, compact, payment, relative } from '@/lib/format';

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
  const [token, sales, offers, freshness, relatedLoad] = await Promise.all([
    getToken(tokenId),
    getTokenSales(tokenId, 12),
    getTokenOffers(tokenId),
    getMarketSource().getFreshness(),
    listTokens({ listedOnly: true, limit: 8 }).catch(() => []),
  ]);
  if (!token) {
    notFound();
  }
  const ask = token.listingPrice;
  const lastSale = token.lastSalePrice;
  const traits = token.traits.filter((t) => t.family !== 'digits' && t.family !== 'number');
  const topCategory = traits[0];
  const materialTrait = token.traits.find((t) => t.family === 'material');
  const atmosphereSrc = materialTrait
    ? showroomHeroForCategory(materialTrait.slug)
    : SHOWROOM_MEDIA.categoryHero;
  const snapshot = await getMarketSource().getCollectionSnapshot().catch(() => null);
  const explorerContract = `${CHAIN_DISPLAY.explorerUrl}/address/${token.contractAddress}`;
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
  const related = relatedLoad.filter((t) => t.tokenId !== token.tokenId).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
        <Link href="/market" className="transition-colors hover:text-[var(--color-text-primary)]">
          Market
        </Link>
        {topCategory ? (
          <>
            <span>/</span>
            <Link
              href={`/categories/${topCategory.slug}`}
              className="transition-colors hover:text-[var(--color-text-primary)]"
            >
              {topCategory.label}
            </Link>
          </>
        ) : null}
        <span>/</span>
        <span className="text-numeral text-[var(--color-text-primary)]">#{token.tokenId}</span>
      </nav>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex gap-3 lg:col-span-6">
          <div className="hidden w-16 shrink-0 flex-col gap-2 md:flex">
            {[token.imageUrl].map((src) => (
              <div
                key={src}
                className="relative aspect-square overflow-hidden rounded-[12px] border border-[var(--color-border-active)]"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  unoptimized={isProxyImageUrl(src) || src.endsWith('.svg')}
                  className="object-contain p-1"
                />
              </div>
            ))}
          </div>
          <div className="relative min-h-[28rem] flex-1 overflow-hidden rounded-[24px] border border-[var(--color-border-subtle)]">
            <Image
              src={atmosphereSrc}
              alt=""
              fill
              className="object-cover object-center opacity-70"
              priority
            />
            <Image
              src={token.imageUrl}
              alt={`Button Presser #${token.tokenId}`}
              fill
              priority
              unoptimized={isProxyImageUrl(token.imageUrl) || token.imageUrl.endsWith('.svg')}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-contain p-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-eyebrow">Button Presser Numbers</span>
              <h1 className="text-display text-[clamp(2.4rem,5vw,3.6rem)]">
                Button Presser #{token.tokenId}
              </h1>
            </div>
            <div className="flex gap-2">
              <span className="nv-icon-btn h-10 w-10">
                <Heart size={16} />
              </span>
              <span className="nv-icon-btn h-10 w-10">
                <ShareNetwork size={16} />
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {traits.slice(0, 4).map((t) => (
              <Link key={t.slug} href={`/categories/${t.slug}`} className="nv-chip nv-chip-strong">
                {t.label}
              </Link>
            ))}
            <LiveIndicator
              tone={freshness.fresh ? 'green' : 'amber'}
              size={6}
              label={freshness.fresh ? 'Verified' : 'Syncing'}
            />
          </div>
          <p className="text-body max-w-[52ch]">
            {token.description?.trim() ||
              `A genuine Button Presser from the original NetNet Capital Management collection. Number ${token.tokenId}.`}
          </p>

          <div className="nv-glass grid grid-cols-1 gap-4 rounded-[18px] p-4 sm:grid-cols-3">
            <div>
              <span className="text-eyebrow-muted">Current price</span>
              <p className="text-numeral text-[2rem] font-semibold text-[var(--color-text-primary)]">
                {payment(ask, token.currency)}
              </p>
            </div>
            <div>
              <span className="text-eyebrow-muted">Last sale</span>
              <p className="text-numeral text-xl font-semibold">{payment(lastSale, token.currency)}</p>
            </div>
            <div>
              <span className="text-eyebrow-muted">Best offer</span>
              <p className="text-numeral text-xl font-semibold">
                {offers[0] ? payment(offers[0].price, token.currency) : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Owner" value={token.ownerAddress ? address(token.ownerAddress) : '—'} />
            <Stat label="Collection" value="Button Presser" />
            <Stat label="Floor" value={payment(snapshot?.floorPrice ?? null, token.currency)} />
            <Stat label="Supply" value={compact(snapshot?.totalSupply ?? 62093)} />
          </div>

          <TokenCommercePanel
            tokenId={token.tokenId}
            imageUrl={token.imageUrl}
            ask={ask}
            lastSale={lastSale}
            openseaUrl={`https://opensea.io/assets/robinhood/${token.contractAddress}/${token.tokenId}`}
            contractAddress={token.contractAddress}
            currency={token.currency}
            listingOrderHash={token.listingOrderHash ?? null}
            listingPriceRaw={token.listingPriceRaw ?? null}
          />
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            Secure purchase on Net Vision. Assets transfer on-chain via your connected wallet.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="nv-glass rounded-[18px] p-5 lg:col-span-4">
          <h2 className="text-display mb-4 text-xl">Traits</h2>
          <div className="grid grid-cols-2 gap-2">
            {token.traits.map((t) => (
              <Link
                key={t.slug}
                href={`/categories/${t.slug}`}
                className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[rgba(5,9,8,0.35)] p-3"
              >
                <span className="text-eyebrow-muted">{t.family}</span>
                <span className="mt-1 block text-sm font-semibold">{t.label}</span>
              </Link>
            ))}
          </div>
        </article>
        <article className="nv-glass rounded-[18px] p-5 lg:col-span-5">
          <h2 className="text-display mb-2 text-xl">Price history</h2>
          <EmptyState
            title="Chart not backed yet"
            body="A price chart will appear here when a historical series is available. Sales below are live."
            tone="muted"
          />
        </article>
        <article className="nv-glass rounded-[18px] p-5 lg:col-span-3">
          <h2 className="text-display mb-4 text-xl">On-chain</h2>
          <dl className="flex flex-col gap-3 text-sm">
            <Field label="Contract">
              <a href={explorerContract} target="_blank" rel="noreferrer" className="text-numeral">
                {address(token.contractAddress)}
                <ArrowUpRight size={11} />
              </a>
            </Field>
            <Field label="Token ID">
              <span className="text-numeral">{token.tokenId}</span>
            </Field>
            <Field label="Standard">
              <span>{BUTTON_PRESSER_COLLECTION.tokenStandard}</span>
            </Field>
            <Field label="Chain">
              <span>{CHAIN_DISPLAY.name}</span>
            </Field>
          </dl>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {saleEntries.length === 0 ? (
          <EmptyState title="No trade history for this token" body="Sales will land here as they clear." tone="muted" />
        ) : (
          <SalesOffersList title="Sales history" type="sale" entries={saleEntries} empty="" />
        )}
        <div>
          <h3 className="text-display mb-4 text-xl">Offer activity</h3>
          <div className="flex flex-col gap-4">
            <OffersPanel tokenId={token.tokenId} isOwner={false} />
            <OfferActions tokenId={token.tokenId} ownerAddress={token.ownerAddress} offers={offers} />
          </div>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-display text-2xl">Related items</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {related.map((item) => (
              <AssetCard key={item.tokenId} token={item} showActions={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="nv-metric-card flex-col items-start gap-1">
      <span className="text-eyebrow-muted">{label}</span>
      <span className="text-numeral text-sm font-semibold">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-eyebrow-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
