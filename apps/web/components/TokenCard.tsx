import Link from 'next/link';
import type { Token } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';

export function TokenCard({ token, href }: { token: Token; href?: string }) {
  const target = href ?? `/tokens/${token.tokenId}`;
  const ask = token.listingPriceEth ? Number.parseFloat(token.listingPriceEth) : null;
  return (
    <Link
      href={target}
      className="nv-panel hover:border-[var(--nv-green)] transition-colors block overflow-hidden"
    >
      <div className="aspect-square bg-[var(--nv-panel-elevated)] flex items-center justify-center relative">
        <img
          src={token.imageUrl}
          alt={`Button Presser #${token.tokenId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-[var(--nv-muted)] bg-[var(--nv-panel)]/80 px-1.5 py-0.5 rounded">
          OS
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="nv-numeral text-sm font-semibold">#{token.tokenId}</span>
          <span className="text-xs nv-mono text-[var(--nv-text)]">
            {ask !== null ? formatPrice(ask) : '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {token.traits
            .filter((t) => t.family !== 'digits')
            .slice(0, 2)
            .map((t) => (
              <span key={t.slug} className="text-[10px] uppercase tracking-wider text-[var(--nv-muted)]">
                {t.label}
              </span>
            ))}
        </div>
      </div>
    </Link>
  );
}
