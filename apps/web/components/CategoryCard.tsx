import Link from 'next/link';
import { formatPrice, formatPercent } from '@net-vision/ui';
import type { CategoryMetrics } from '@/lib/data/categories';

export function CategoryCard({ metrics }: { metrics: CategoryMetrics }) {
  const listedPct = metrics.memberSupply > 0 ? metrics.listedCount / metrics.memberSupply : 0;
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className="nv-panel p-4 flex flex-col gap-3 hover:border-[var(--nv-green)] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-[var(--nv-text)]">{metrics.name}</div>
          <div className="text-xs text-[var(--nv-muted)] nv-mono">{metrics.slug}</div>
        </div>
        <span className="nv-chip">{metrics.family}</span>
      </div>
      <p className="text-sm text-[var(--nv-muted)] line-clamp-2">{metrics.description}</p>
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--nv-border)]">
        <div className="nv-stat">
          <span className="nv-stat-label">Members</span>
          <span className="nv-stat-value nv-mono">{metrics.memberSupply}</span>
        </div>
        <div className="nv-stat">
          <span className="nv-stat-label">Listed</span>
          <span className="nv-stat-value nv-mono">{formatPercent(listedPct)}</span>
        </div>
        <div className="nv-stat">
          <span className="nv-stat-label">Floor</span>
          <span className="nv-stat-value nv-stat-value-strong nv-mono">
            {formatPrice(metrics.floorPriceEth)}
          </span>
        </div>
      </div>
    </Link>
  );
}
