import type { DataFreshness } from '@/lib/market';
import { formatRelativeTime } from '@net-vision/ui';

export function DataFreshnessBadge({ freshness }: { freshness: DataFreshness }) {
  if (freshness.fresh && freshness.source === 'opensea') {
    return (
      <span className="nv-chip nv-chip-strong" title="Live from OpenSea">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-green)]" />
        Live
      </span>
    );
  }
  if (freshness.source === 'opensea' && freshness.refreshedAt) {
    return (
      <span className="nv-chip" title="Cached snapshot from OpenSea">
        Cached {formatRelativeTime(Math.floor(freshness.refreshedAt / 1000))}
      </span>
    );
  }
  return (
    <span className="nv-chip" title="Live OpenSea data is unavailable">
      Unavailable
    </span>
  );
}
