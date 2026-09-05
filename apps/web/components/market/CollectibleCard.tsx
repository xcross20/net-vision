'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Plus } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { Token } from '@/lib/market';
import { buildTokenImageUrl, isProxyImageUrl } from '@/lib/data/media';
import { MarketplaceBadge } from '@/components/ui/MarketplaceBadge';
import { Price } from '@/components/ui/Price';

export function CollectibleCard({
  token,
  selected,
  onToggle,
  selectable = true,
  priority = false,
}: {
  token: Token;
  selected?: boolean;
  onToggle?: (token: Token) => void;
  selectable?: boolean;
  priority?: boolean;
}) {
  const [src, setSrc] = useState(token.imageUrl);
  useEffect(() => {
    setSrc(token.imageUrl);
  }, [token.imageUrl]);

  const ask = token.listingPrice;
  const topTraits = token.traits
    .filter((t) => t.family !== 'digits' && t.family !== 'number')
    .slice(0, 2);
  const canSelect = selectable && ask !== null && onToggle;
  const unoptimized = isProxyImageUrl(src) || src.endsWith('.svg');
  return (
    <div
      className={cn(
        'group/card relative flex h-full flex-col overflow-hidden rounded-[var(--radius-md)]',
        'bg-[var(--color-surface-1)] border transition-colors',
        selected
          ? 'border-[var(--color-net-green)]'
          : 'border-transparent hover:border-[var(--color-border-default)]',
      )}
    >
      {canSelect ? (
        <button
          type="button"
          aria-label={selected ? `Deselect #${token.tokenId}` : `Select #${token.tokenId}`}
          aria-pressed={selected}
          onClick={() => onToggle(token)}
          className={cn(
            'absolute left-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md',
            selected
              ? 'border-[var(--color-net-green)] bg-[var(--color-net-green)] text-[var(--color-bg)]'
              : 'border-[var(--color-border-default)] bg-[rgba(8,12,10,0.72)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          )}
        >
          {selected ? <Check size={13} weight="bold" /> : <Plus size={13} weight="bold" />}
        </button>
      ) : null}
      <Link href={`/tokens/${token.tokenId}`} className="flex h-full flex-col">
        <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-2)]">
          <Image
            src={src}
            alt={`Button Presser #${token.tokenId}`}
            fill
            sizes="(min-width: 1280px) 18rem, (min-width: 768px) 33vw, 50vw"
            priority={priority}
            unoptimized={unoptimized}
            className="object-contain p-3"
            onError={() => {
              const fallback = buildTokenImageUrl(token.tokenId);
              if (src !== fallback) setSrc(fallback);
            }}
          />
          <div className="pointer-events-none absolute right-2 top-2">
            <MarketplaceBadge source="opensea" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-numeral text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                #{token.tokenId}
              </span>
              <span className="truncate text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                {topTraits.length === 0 ? 'Button Presser' : topTraits.map((t) => t.label).join(' / ')}
              </span>
            </div>
            <Price value={ask} currency={token.currency} size="md" align="right" />
          </div>
          <div className="mt-auto text-[11px] text-[var(--color-text-tertiary)]">
            Last {token.lastSalePrice !== null ? token.lastSalePrice.toLocaleString() : '—'}
          </div>
        </div>
      </Link>
    </div>
  );
}
