'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';
import { buildTokenImageUrl, isProxyImageUrl } from '@/lib/data/media';
import { MarketplaceBadge } from './MarketplaceBadge';
import { Price } from './Price';
import { AddToCartButton, BuyNowButton } from '@/components/cart';

/**
 * NFT market card used in grids. It pairs the token number with its
 * exact image, traits, and active ask when one is available. Trade actions
 * remain hidden when no executable ask exists.
 */
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
    .slice(0, 2);
  const unoptimized = isProxyImageUrl(src) || src.endsWith('.svg');
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="group/card h-full"
    >
      <Link
        href={`/tokens/${token.tokenId}`}
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-[18px]',
          'bg-[var(--color-surface-1)] transition-colors',
          'border border-[var(--color-border-subtle)] hover:border-[var(--color-border-active)]',
          'focus-visible:border-[var(--color-border-active)]',
        )}
      >
        <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-2)]">
          <Image
            src={src}
            alt={`Button Presser #${token.tokenId}`}
            fill
            sizes="(min-width: 1280px) 18rem, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            unoptimized={unoptimized}
            className="object-contain p-3 transition-transform duration-500 ease-out group-hover/card:scale-[1.02]"
            onError={() => {
              const fallback = buildTokenImageUrl(token.tokenId);
              if (src !== fallback) setSrc(fallback);
            }}
          />
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5">
            <MarketplaceBadge source="opensea" />
          </div>
          <div className="pointer-events-none absolute right-2 top-2 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 max-md:opacity-100">
            <button
              type="button"
              aria-label={favorited ? 'Unfavorite' : 'Favorite'}
              aria-pressed={favorited}
              onClick={(e) => {
                e.preventDefault();
                setFavorited((v) => !v);
              }}
              className={cn(
                'pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-colors',
                favorited
                  ? 'border-[var(--color-border-active)] bg-[rgba(72,235,145,0.16)] text-[var(--color-net-green)]'
                  : 'border-[var(--color-border-default)] bg-[rgba(8,12,10,0.72)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <Heart size={13} weight={favorited ? 'fill' : 'regular'} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex min-w-0 flex-col gap-1.5">
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
          </div>
          <div className="mt-auto flex items-end justify-between gap-3">
            <Price value={ask} currency={token.currency} size="md" align="left" />
            <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">
              {token.lastSalePrice !== null
                ? `Last ${token.lastSalePrice.toFixed(2)} ${token.currency}`
                : token.rarityRank !== null
                  ? `Rank #${token.rarityRank.toLocaleString()}`
                  : 'Unranked'}
            </span>
          </div>
          {canTrade ? (
            <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
              <BuyNowButton
                draft={{
                  token,
                  displayedPriceDecimal: ask.toString(),
                  currencySymbol: token.currency,
                }}
                className="h-10 flex-1 px-3 text-[13px]"
              />
              <AddToCartButton
                variant="compact"
                className="border-[var(--color-border-default)]"
                draft={{
                  token,
                  displayedPriceDecimal: ask.toString(),
                  currencySymbol: token.currency,
                }}
              />
            </div>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
