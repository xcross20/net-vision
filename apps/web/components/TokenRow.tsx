import Link from 'next/link';
import type { Token } from '@/lib/market';
import { formatPrice } from '@net-vision/ui';

export function TokenRow({ token }: { token: Token }) {
  const ask = token.listingPriceEth ? Number.parseFloat(token.listingPriceEth) : null;
  return (
    <Link
      href={`/tokens/${token.tokenId}`}
      className="grid grid-cols-12 gap-4 items-center px-3 py-3 border-b border-[var(--nv-border)] hover:bg-[var(--nv-panel-elevated)] transition-colors"
    >
      <div className="col-span-1 nv-numeral text-sm font-semibold">#{token.tokenId}</div>
      <div className="col-span-4">
        <div className="aspect-square max-w-[80px] bg-[var(--nv-panel-elevated)] overflow-hidden">
          <img
            src={token.imageUrl}
            alt={`Button Presser #${token.tokenId}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
      <div className="col-span-3 flex flex-wrap gap-1">
        {token.traits.slice(0, 3).map((t) => (
          <span key={t.slug} className="text-[10px] uppercase tracking-wider text-[var(--nv-muted)]">
            {t.label}
          </span>
        ))}
      </div>
      <div className="col-span-2 text-right text-sm nv-mono">
        {ask !== null ? formatPrice(ask) : '—'}
      </div>
      <div className="col-span-2 text-right text-xs nv-mono text-[var(--nv-muted)]">
        {token.ownerAddress
          ? `${token.ownerAddress.slice(0, 6)}…${token.ownerAddress.slice(-4)}`
          : '—'}
      </div>
    </Link>
  );
}
