import type { CategoryMetrics } from '@/lib/market';
import { compact, payment, pct, relative } from '@/lib/format';
import { MarketMetricsBar } from '@/components/market/MarketMetricsBar';

export function CategoryMetricsStrip({ metrics }: { metrics: CategoryMetrics }) {
  const syncing = metrics.marketStatus === 'syncing';
  const currency = metrics.currency;
  return (
    <div className="flex flex-col gap-3">
      <MarketMetricsBar
        items={[
          {
            label: 'Floor',
            value: syncing ? 'Syncing' : payment(metrics.floorPrice, currency),
            emphasis: true,
          },
          { label: 'Best offer', value: syncing ? '—' : payment(metrics.topOfferPrice, currency) },
          {
            label: syncing ? 'Known listed' : 'Listed',
            value: metrics.listedCount.toLocaleString(),
            sub: `${metrics.memberSupply.toLocaleString()} items`,
          },
          { label: 'Owners', value: metrics.owners.toLocaleString() },
          { label: '24h volume', value: syncing ? '—' : compact(metrics.volume24h) },
          { label: '7d volume', value: syncing ? '—' : compact(metrics.volume7d) },
          {
            label: 'Highest sale',
            value: syncing ? '—' : payment(metrics.highestSale?.price ?? null, currency),
            sub: metrics.highestSale ? `#${metrics.highestSale.tokenId}` : undefined,
          },
          { label: '7d floor', value: syncing ? '—' : pct(metrics.floorChange7d) },
        ]}
      />
      <p className="text-[12px] text-[var(--color-text-tertiary)]">
        Tracked since {relative(Math.floor(metrics.trackedSince / 1000))}. Incomplete coverage is
        never shown as a zero floor.
      </p>
    </div>
  );
}
