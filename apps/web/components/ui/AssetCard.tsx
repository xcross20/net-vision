'use client';

import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, Eye } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';
import { MarketplaceBadge } from './MarketplaceBadge';
import { Price } from './Price';
import { AddToCartButton } from '@/components/cart';

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
  const ask = token.listingPrice;
  const canTrade = showActions && ask !== null;
  const topTraits = token.traits
    .filter((t) => t.family !== 'digits' && t.family !== 'number')
    .slice(0, 2);
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
          'flex h-full flex-col overflow-hidden rounded-[var(--radius-md)]',
          'bg-[var(--color-surface-1)] transition-colors',
          'border border-transparent hover:border-[var(--color-border-default)]',
          'focus-visible:border-[var(--color-border-active)]',
        )}
      >
        <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-2)]">
          <Image
            src={token.imageUrl}
            alt={`Button Presser #${token.tokenId}`}
            fill
            sizes="(min-width: 1280px) 18rem, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.02]"
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
          {canTrade ? (
            <>
              <div className="pointer-events-none absolute inset-x-2 bottom-2 opacity-0 transition-all duration-200 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-hover/card:pointer-events-auto max-md:hidden">
                <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-net-green)] px-3 text-[13px] font-semibold tracking-tight text-[var(--color-bg)]">
                  Buy now
                  <ArrowRight size={12} weight="bold" />
                </span>
              </div>
              <div className="absolute bottom-2 right-2 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 max-md:opacity-100">
                <AddToCartButton
                  variant="compact"
                  className="border-[var(--color-border-default)] bg-[rgba(8,12,10,0.78)] backdrop-blur-md"
                  draft={{
                    token,
                    displayedPriceDecimal: ask.toString(),
                    currencySymbol: token.currency,
                  }}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-numeral text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                #{token.tokenId}
              </span>
              <span className="truncate text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                {topTraits.length === 0
                  ? 'Button Presser'
                  : topTraits.map((t) => t.label).join(' / ')}
              </span>
            </div>
            <Price value={ask} currency={token.currency} size="md" align="right" />
          </div>
          <div className="mt-auto flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
            <span className="inline-flex items-center gap-1">
              <Eye size={11} weight="duotone" className="text-[var(--color-text-tertiary)]" />
              Open
            </span>
            <span className="text-numeral">
              {token.rarityRank !== null ? `Rank #${token.rarityRank.toLocaleString()}` : 'Unranked'}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
