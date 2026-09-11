'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Heart } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';
import { isProxyImageUrl, resolveTokenImageUrl } from '@/lib/data/media';
import { SHOWROOM_MEDIA, isShowroomPath } from '@/lib/brand/media';
import { pct } from '@/lib/format';
import { Price } from './Price';
import { AddToCartButton, BuyNowButton } from '@/components/cart';

export function AssetCard({
  token,
  priority = false,
  showActions = true,
}: {
  token: Token;
  priority?: boolean;
  showActions?: boolean;
}) {
  const [favorited, setFavorited] = useState(false);
  const [src, setSrc] = useState(token.imageUrl);
  useEffect(() => {
    setSrc(token.imageUrl);
  }, [token.imageUrl]);
  const ask = token.listingPrice;
  const canTrade = showActions && ask !== null;
  const topTraits = token.traits
    .filter((t) => t.family !== 'digits' && t.family !== 'number')
    .slice(0, 3);
  const unoptimized = isProxyImageUrl(src) || src.endsWith('.svg');
  const delta =
    ask !== null && token.lastSalePrice !== null && token.lastSalePrice > 0
      ? (ask - token.lastSalePrice) / token.lastSalePrice
      : null;
  const mediaSrc = isShowroomPath(src) ? resolveTokenImageUrl(token.tokenId, null) : src;

  return (
    <motion.div
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="group/card h-full"
    >
      <div
        className={cn(
          'nv-asset-card flex h-full flex-col overflow-hidden rounded-[22px]',
          'border border-[rgba(92,255,153,0.12)] bg-[rgba(7,14,11,0.88)]',
          'shadow-[0_18px_40px_rgba(0,0,0,0.28)]',
          'transition-[border-color,box-shadow] duration-200',
          'hover:border-[rgba(83,255,145,0.32)]',
          'hover:shadow-[0_22px_60px_rgba(0,0,0,0.42),0_0_0_1px_rgba(83,255,145,0.28),0_0_36px_rgba(66,255,137,0.08)]',
        )}
      >
        <Link href={`/tokens/${token.tokenId}`} className="relative block aspect-[4/5] overflow-hidden">
          <Image
            src={SHOWROOM_MEDIA.cardStage}
            alt=""
            fill
            sizes="(min-width: 1280px) 24rem, 50vw"
            className="object-cover"
            priority={priority}
          />
          <Image
            src={mediaSrc}
            alt={`Button Presser #${token.tokenId}`}
            fill
            sizes="(min-width: 1280px) 24rem, 50vw"
            priority={priority}
            unoptimized={unoptimized}
            className="relative z-[2] object-contain p-8 brightness-110 contrast-110 transition-transform duration-500 ease-out group-hover/card:scale-[1.03]"
            onError={() => {
              const fallback = resolveTokenImageUrl(token.tokenId, null);
              if (src !== fallback) setSrc(fallback);
            }}
          />
          <span className="nv-glass-2 absolute left-3 top-3 z-[3] inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--color-net-green)]">
            #{token.tokenId}
          </span>
          <button
            type="button"
            aria-label={favorited ? 'Unfavorite' : 'Favorite'}
            aria-pressed={favorited}
            onClick={(e) => {
              e.preventDefault();
              setFavorited((v) => !v);
            }}
            className={cn(
              'absolute right-3 top-3 z-[3] inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md',
              favorited
                ? 'border-[var(--color-border-active)] bg-[rgba(72,235,145,0.16)] text-[var(--color-net-green)]'
                : 'border-[var(--color-border-default)] bg-[rgba(8,12,10,0.55)] text-[var(--color-text-secondary)]',
            )}
          >
            <Heart size={14} weight={favorited ? 'fill' : 'regular'} />
          </button>
        </Link>

        <div className="relative z-[2] flex flex-1 flex-col gap-4 p-5">
          <Link href={`/tokens/${token.tokenId}`} className="flex flex-col gap-2.5">
            <span className="truncate text-[17px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              Button Presser #{token.tokenId}
            </span>
            <span className="flex flex-wrap gap-1.5">
              {topTraits.length === 0 ? (
                <span className="nv-chip">Button Presser</span>
              ) : (
                topTraits.map((trait) => (
                  <span key={trait.slug} className="nv-chip">
                    {trait.label}
                  </span>
                ))
              )}
            </span>
          </Link>
          <div className="mt-auto flex items-end justify-between gap-3">
            <Price value={ask} currency={token.currency} size="lg" align="left" />
            <span
              className={cn(
                'text-numeral text-[13px]',
                delta !== null && delta > 0
                  ? 'text-[var(--color-net-green)]'
                  : delta !== null && delta < 0
                    ? 'text-[var(--color-danger)]'
                    : 'text-[var(--color-text-tertiary)]',
              )}
            >
              {delta !== null
                ? pct(delta)
                : token.lastSalePrice !== null
                  ? `Last ${token.lastSalePrice.toFixed(2)}`
                  : '—'}
            </span>
          </div>
          {canTrade ? (
            <div className="grid grid-cols-2 gap-2.5">
              <AddToCartButton
                variant="primary"
                className="h-11 text-[14px]"
                draft={{
                  token,
                  displayedPriceDecimal: ask.toString(),
                  currencySymbol: token.currency,
                }}
              />
              <BuyNowButton
                label="Buy Now"
                draft={{
                  token,
                  displayedPriceDecimal: ask.toString(),
                  currencySymbol: token.currency,
                }}
                className="nv-button-ghost h-11 px-3 text-[14px] shadow-none"
              />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
