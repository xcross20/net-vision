'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';
import { buildTokenImageUrl, isProxyImageUrl } from '@/lib/data/media';
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
  const mediaSrc = isShowroomPath(src) ? buildTokenImageUrl(token.tokenId) : src;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="group/card h-full"
    >
      <div
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-[18px]',
          'border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]',
          'transition-[border-color,box-shadow] duration-200',
          'hover:border-[var(--color-border-active)] hover:shadow-[var(--shadow-green-active)]',
        )}
      >
        <Link href={`/tokens/${token.tokenId}`} className="relative block aspect-square overflow-hidden">
          <Image
            src={SHOWROOM_MEDIA.cardStage}
            alt=""
            fill
            sizes="(min-width: 1280px) 18rem, 50vw"
            className="object-cover opacity-80"
            priority={priority}
          />
          <Image
            src={mediaSrc}
            alt={`Button Presser #${token.tokenId}`}
            fill
            sizes="(min-width: 1280px) 18rem, 50vw"
            priority={priority}
            unoptimized={unoptimized}
            className="object-contain p-6 transition-transform duration-500 ease-out group-hover/card:scale-[1.04]"
            onError={() => {
              const fallback = buildTokenImageUrl(token.tokenId);
              if (src !== fallback) setSrc(fallback);
            }}
          />
          <span className="nv-glass absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--color-net-green)]">
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
              'absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md',
              favorited
                ? 'border-[var(--color-border-active)] bg-[rgba(72,235,145,0.16)] text-[var(--color-net-green)]'
                : 'border-[var(--color-border-default)] bg-[rgba(8,12,10,0.72)] text-[var(--color-text-secondary)]',
            )}
          >
            <Heart size={13} weight={favorited ? 'fill' : 'regular'} />
          </button>
        </Link>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <Link href={`/tokens/${token.tokenId}`} className="flex flex-col gap-2">
            <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              Button Presser #{token.tokenId}
            </span>
            <span className="flex flex-wrap gap-1">
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
            <Price value={ask} currency={token.currency} size="md" align="left" />
            <span
              className={cn(
                'text-numeral text-[12px]',
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
            <div className="grid grid-cols-2 gap-2">
              <AddToCartButton
                variant="primary"
                className="h-10 text-[13px]"
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
                className="nv-button-ghost h-10 px-3 text-[13px] shadow-none"
              />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
