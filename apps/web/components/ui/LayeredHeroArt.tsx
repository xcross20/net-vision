'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import { payment } from '@/lib/format';
import { MarketplaceBadge } from './MarketplaceBadge';
import { LiveIndicator } from './LiveIndicator';
import type { Token } from '@/lib/market';

/**
 * Layered hero artwork. Stacks three real Button Presser tokens with
 * staggered offsets so the composition feels three-dimensional without
 * resorting to gradients. Each card surfaces the token number, ask
 * price, and marketplace so it functions as a real product preview,
 * not a decorative motif.
 *
 * On small screens the stack collapses into a single-column rhythm.
 */
export function LayeredHeroArt({ tokens }: { tokens: Token[] }) {
  const safe = tokens.length > 0 ? tokens.slice(0, 3) : [];
  if (safe.length === 0) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <LiveIndicator tone="amber" size={6} label="Loading live inventory" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Pulling live inventory from Robinhood Chain.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-md">
      <span className="absolute -top-3 left-0 z-10 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)]">
        <LiveIndicator tone="green" size={6} label="Live inventory" />
      </span>

      {safe.map((t, idx) => (
        <LayeredCard
          key={t.tokenId}
          token={t}
          index={idx}
          total={safe.length}
        />
      ))}
    </div>
  );
}

function LayeredCard({
  token,
  index,
  total,
}: {
  token: Token;
  index: number;
  total: number;
}) {
  const ask = token.listingPrice;
  // Stagger the depth using translateY + scale so each card feels a layer
  // apart. The middle card is the focal point.
  const depth =
    total === 1
      ? { y: 0, scale: 1, rotate: 0 }
      : index === 0
        ? { y: 16, scale: 0.92, rotate: -3 }
        : index === total - 1
          ? { y: 16, scale: 0.92, rotate: 3 }
          : { y: 0, scale: 1, rotate: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: depth.y }}
      transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.1 + index * 0.08 }}
      whileHover={{ y: depth.y - 4, scale: depth.scale + 0.01 }}
      className={cn(
        'absolute left-0 right-0 top-0',
        'origin-center will-change-transform',
      )}
      style={{
        zIndex: total - index,
        transform: `rotate(${depth.rotate}deg) scale(${depth.scale})`,
      }}
    >
      <Link
        href={`/tokens/${token.tokenId}`}
        className={cn(
          'group/card flex flex-col overflow-hidden rounded-[var(--radius-lg)]',
          'bg-[var(--color-surface-1)] border border-[var(--color-border-default)]',
          'transition-colors hover:border-[var(--color-border-active)]',
        )}
      >
        <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-2)]">
          <Image
            src={token.imageUrl}
            alt={`Button Presser #${token.tokenId}`}
            fill
            sizes="(min-width: 1024px) 22rem, 70vw"
            priority={index === Math.floor(total / 2)}
            className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-[1.03]"
          />
          <div className="absolute left-3 top-3">
            <MarketplaceBadge source="opensea" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-numeral text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              #{token.tokenId}
            </span>
            <span className="truncate text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              {token.traits
                .filter((t) => t.family !== 'digits')
                .slice(0, 2)
                .map((t) => t.label)
                .join(' / ') || 'Button Presser'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-numeral text-[13px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {payment(ask, token.currency, '—')}
            </span>
            <ArrowUpRight
              size={12}
              weight="bold"
              className="text-[var(--color-text-tertiary)] transition-colors group-hover/card:text-[var(--color-net-green)]"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
