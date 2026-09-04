import Link from 'next/link';
import type { SeededToken } from '@/lib/data/seed';
import { formatPrice } from '@net-vision/ui';

export function TokenCard({ token, href }: { token: SeededToken; href?: string }) {
  const target = href ?? `/tokens/${token.tokenId}`;
  return (
    <Link href={target} className="nv-panel hover:border-[var(--nv-green)] transition-colors block overflow-hidden">
      <div className="aspect-square bg-[var(--nv-panel-elevated)] flex items-center justify-center">
        <img
          src={token.imageUrl}
          alt={`Button Presser #${token.tokenId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-2 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="nv-numeral text-sm font-semibold">#{token.tokenId}</span>
          <span className="nv-chip" title="Listing price">
            {token.listingPriceEth ? formatPrice(Number.parseFloat(token.listingPriceEth)) : '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {token.traits.slice(0, 2).map((t) => (
            <span key={t.slug} className="nv-chip">
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
