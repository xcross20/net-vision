import type { DataFreshness } from '@/lib/market';
import { formatRelativeTime } from '@net-vision/ui';
import { LivePulse } from '@/components/motion';
import { ClockIcon, WarnIcon } from '@/components/icons';

export function DataFreshnessBadge({ freshness }: { freshness: DataFreshness }) {
  if (freshness.fresh && freshness.source === 'opensea') {
    return (
      <span className="nv-chip nv-chip-strong" title="Live from OpenSea" aria-live="polite">
        <LivePulse size={6} />
        Live
      </span>
    );
  }
  if (freshness.source === 'opensea' && freshness.refreshedAt) {
    return (
      <span className="nv-chip" title="Cached snapshot from OpenSea">
        <ClockIcon size={12} weight="bold" />
        Cached {formatRelativeTime(Math.floor(freshness.refreshedAt / 1000))}
      </span>
    );
  }
  if (freshness.source === 'fixture') {
    return (
      <span className="nv-chip" title="Live OpenSea data is unavailable">
        Unavailable
      </span>
    );
  }
  return (
    <span className="nv-chip" title={freshness.resolvedChainSlug ?? 'No data'}>
      <WarnIcon size={12} weight="duotone" />
      Degraded
    </span>
  );
}