'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Heart } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';
import { MarketplaceBadge } from './MarketplaceBadge';
import { Price } from './Price';
import { address, payment, relative } from '@/lib/format';

/**
 * Compact row used in dense market tables. Sophisticated collectors
 * want Asset / Price / Last / Category / Listed / Owner on one line.
 *
 * On small screens it collapses to a single row with token id, traits,
 * and price; the user can tap through to the detail page for the full
 * breakdown.
 */
export function AssetRow({ token }: { token: Token }) {
  const ask = token.listingPrice;
  const last = token.lastSalePrice;
  const [favorited, setFavorited] = useState(false);
  const topCategory = token.traits.find((t) => t.family !== 'digits' && t.family !== 'number');
  return (
    <motion.div
      whileHover={{ x: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="group/row"
    >
      <Link
        href={`/tokens/${token.tokenId}`}
        className={cn(
          'grid items-center gap-3 px-3 py-2.5',
          'grid-cols-[2.25rem_minmax(0,1fr)_4.5rem]',
          'md:grid-cols-[3rem_minmax(0,2.5rem)_minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_5.5rem_minmax(0,1fr)_2.5rem]',
          'rounded-[var(--radius-sm)] transition-colors',
          'hover:bg-[var(--color-surface-hover)]',
        )}
      >
        <span className="text-numeral text-sm font-semibold text-[var(--color-text-primary)]">
          #{token.tokenId}
        </span>

        <div className="relative col-start-2 hidden h-9 w-9 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] md:block">
          <Image
            src={token.imageUrl}
            alt=""
            fill
            sizes="2.25rem"
            className="object-cover"
          />
        </div>

        <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
          <span className="truncate text-sm text-[var(--color-text-primary)]">
            Button Presser
            <span className="ml-2 text-[var(--color-text-tertiary)]">
              #{token.tokenId}
            </span>
          </span>
          <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
            {token.traits
              .filter((t) => t.family !== 'digits' && t.family !== 'number')
              .slice(0, 3)
              .map((t) => t.label)
              .join(' · ') || 'Button Presser'}
          </span>
        </div>

        <div className="hidden min-w-0 md:block">
          <span className="truncate text-[12px] text-[var(--color-text-secondary)]">
            {topCategory?.label ?? 'Button Presser'}
          </span>
        </div>

        <div className="hidden md:block">
          <Price value={ask} currency={token.currency} size="sm" align="right" />
        </div>

        <div className="hidden md:block">
          <Price value={last} currency={token.currency} size="sm" align="right" dim />
        </div>

        <div className="hidden min-w-0 md:block">
          <span className="block truncate text-numeral text-[12px] text-[var(--color-text-secondary)]">
            {token.ownerAddress ? address(token.ownerAddress) : '—'}
          </span>
          <span className="block truncate text-[11px] text-[var(--color-text-tertiary)]">
            Listed {token.listedAt ? relative(token.listedAt) : '—'}
          </span>
        </div>

        <div className="col-start-3 flex items-center justify-end gap-2 md:col-start-8">
          <MarketplaceBadge source="opensea" />
          <button
            type="button"
            aria-label={favorited ? 'Unfavorite' : 'Favorite'}
            aria-pressed={favorited}
            onClick={(e) => {
              e.preventDefault();
              setFavorited((v) => !v);
            }}
            className={cn(
              'hidden h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors md:inline-flex',
              favorited
                ? 'text-[var(--color-net-green)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <Heart size={12} weight={favorited ? 'fill' : 'regular'} />
          </button>
        </div>

        <div className="col-span-3 mt-1 flex items-center justify-between md:hidden">
          <Price value={ask} currency={token.currency} size="sm" />
          <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">
            Last {last !== null ? `${last.toFixed(3)} ${token.currency}` : '—'}
          </span>
        </div>
        <ArrowRight
          size={12}
          weight="bold"
          className="col-span-1 justify-self-end text-[var(--color-text-tertiary)] transition-colors group-hover/row:text-[var(--color-net-green)] md:hidden"
        />
      </Link>
    </motion.div>
  );
}
