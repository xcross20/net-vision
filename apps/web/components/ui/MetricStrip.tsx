import { Metric } from './Metric';
import { LiveIndicator } from './LiveIndicator';
import { compact, payment } from '@/lib/format';
import type { CollectionSnapshot, DataFreshness } from '@/lib/market';

/**
 * Borderless collection metric strip. Reads as one continuous line of
 * information rather than four isolated boxes. Used at the top of the
 * homepage hero.
 */
export function MetricStrip({
  snapshot,
  freshness,
}: {
  snapshot: CollectionSnapshot;
  freshness: DataFreshness;
}) {
  const live = snapshot.marketStatus === 'live' && freshness.fresh;
  const freshLabel = live
    ? 'Live'
    : snapshot.marketStatus === 'syncing'
      ? 'Syncing'
      : freshness.refreshedAt
        ? 'Cached'
        : 'Warming';
  const tone = live ? 'green' : 'amber';
  const listedLabel =
    snapshot.marketStatus === 'syncing' ? 'known listed' : 'listed';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-eyebrow-muted">
        <LiveIndicator tone={tone} size={6} label={freshLabel} />
        <span>Collection pulse</span>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[var(--color-border-subtle)] py-6 md:grid-cols-4">
        <Metric
          label="Items"
          value={compact(snapshot.totalSupply)}
          sub={`${snapshot.listedCount.toLocaleString()} ${listedLabel}`}
        />
        <Metric
          label="Floor"
          value={payment(snapshot.floorPrice, snapshot.currency)}
          emphasis
        />
        <Metric
          label="Volume 24h"
          value={payment(snapshot.volume24hNative, 'ETH')}
          sub={
            snapshot.sales24h == null
              ? undefined
              : `${snapshot.sales24h.toLocaleString()} sales`
          }
        />
        <Metric
          label="Owners"
          value={compact(snapshot.owners)}
        />
      </div>
    </div>
  );
}
