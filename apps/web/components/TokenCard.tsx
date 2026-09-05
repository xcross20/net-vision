import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Token } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';
import { TagIcon } from '@/components/icons';

export function TokenCard({ token, href }: { token: Token; href?: string }) {
  const target = href ?? `/tokens/${token.tokenId}`;
  const ask = token.listingPriceEth ? Number.parseFloat(token.listingPriceEth) : null;
  const traits = token.traits.filter((t) => t.family !== 'digits').slice(0, 2);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className="h-full"
    >
      <Link
        href={target}
        className="nv-panel flex h-full flex-col overflow-hidden transition-colors hover:border-[var(--nv-border-strong)]"
      >
        <div className="relative aspect-square bg-[var(--nv-panel-elevated)]">
          <img
            src={token.imageUrl}
            alt={`Button Presser #${token.tokenId}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[rgba(8,17,13,0.7)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--nv-muted)]">
            <TagIcon size={10} weight="duotone" />
            OS
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <span className="nv-numeral text-sm font-semibold tracking-tight">
              #{token.tokenId}
            </span>
            <span className="nv-mono text-xs text-[var(--nv-text-soft)]">
              {ask !== null ? formatPrice(ask) : '—'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {traits.length === 0 ? (
              <span className="text-[10px] uppercase tracking-wider text-[var(--nv-muted-dim)]">
                Button Presser
              </span>
            ) : (
              traits.map((t) => (
                <span
                  key={t.slug}
                  className="text-[10px] uppercase tracking-wider text-[var(--nv-muted)]"
                >
                  {t.label}
                </span>
              ))
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TokenCardSkeleton() {
  return (
    <div className="nv-panel overflow-hidden">
      <div className="nv-skeleton aspect-square rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <div className="nv-skeleton h-3 w-16" />
        <div className="nv-skeleton h-2 w-12" />
      </div>
    </div>
  );
}