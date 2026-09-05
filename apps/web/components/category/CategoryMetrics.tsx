import type { CategoryMetrics } from '@/lib/market';
import { compact, payment, pct, relative } from '@/lib/format';
import Link from 'next/link';

export function CategoryMetricsStrip({ metrics }: { metrics: CategoryMetrics }) {
  const syncing = metrics.marketStatus === 'syncing';
  const currency = metrics.currency;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[var(--color-border-subtle)] py-6 md:grid-cols-4">
        <Stat
          label="Floor"
          value={syncing ? 'Syncing' : payment(metrics.floorPrice, currency)}
          emphasis
        />
        <Stat label="Best offer" value={syncing ? '—' : payment(metrics.topOfferPrice, currency)} />
        <Stat
          label={syncing ? 'Known listed' : 'Listed'}
          value={
            syncing
              ? metrics.listedCount.toLocaleString()
              : `${metrics.listedCount.toLocaleString()} / ${metrics.memberSupply.toLocaleString()}`
          }
          sub={
            syncing
              ? `Verified ${metrics.verifiedCount.toLocaleString()} / ${metrics.memberSupply.toLocaleString()} · ${(metrics.coveragePercent * 100).toFixed(1)}%`
              : metrics.staleListedCount > 0
                ? `${metrics.staleListedCount} awaiting reverification`
                : undefined
          }
        />
        <Stat label="Owners" value={metrics.owners.toLocaleString()} />
        <Stat label="24h volume" value={syncing ? '—' : compact(metrics.volume24h)} />
        <Stat label="7d volume" value={syncing ? '—' : compact(metrics.volume7d)} />
        <Stat
          label="High sale"
          value={syncing ? '—' : payment(metrics.highestSale?.price ?? null, currency)}
          sub={
            metrics.highestSale ? (
              <Link href={`/tokens/${metrics.highestSale.tokenId}`} className="hover:text-[var(--color-net-green)]">
                #{metrics.highestSale.tokenId}
              </Link>
            ) : undefined
          }
        />
        <Stat
          label="7d floor"
          value={syncing ? '—' : pct(metrics.floorChange7d)}
        />
      </div>
      <p className="text-[12px] text-[var(--color-text-tertiary)]">
        Tracked since {relative(Math.floor(metrics.trackedSince / 1000))}. Incomplete coverage is
        never shown as a zero floor.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow-muted">{label}</span>
      <span
        className={
          emphasis
            ? 'text-numeral text-xl font-semibold tracking-tight text-[var(--color-net-green)] md:text-2xl'
            : 'text-numeral text-xl font-semibold tracking-tight text-[var(--color-text-primary)] md:text-2xl'
        }
      >
        {value}
      </span>
      {sub ? <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">{sub}</span> : null}
    </div>
  );
}
