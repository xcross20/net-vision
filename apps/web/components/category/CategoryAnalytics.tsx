'use client';

import { useEffect, useState } from 'react';
import type { CategoryMetrics } from '@/lib/market';
import type { FloorSnapshot } from '@/lib/market/engine';
import { compact, pct } from '@/lib/format';

export function CategoryAnalytics({
  slug,
  metrics,
}: {
  slug: string;
  metrics: CategoryMetrics;
}) {
  const [history, setHistory] = useState<FloorSnapshot[]>([]);
  useEffect(() => {
    void fetch(`/api/categories/${encodeURIComponent(slug)}/analytics`)
      .then((res) => res.json())
      .then((body: { floorHistory?: FloorSnapshot[] }) => setHistory(body.floorHistory ?? []))
      .catch(() => setHistory([]));
  }, [slug]);

  const listedPct =
    metrics.memberSupply > 0 ? metrics.listedCount / metrics.memberSupply : 0;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <span className="text-eyebrow-muted">Floor</span>
        <FloorSparkline points={history} />
        {history.length < 2 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Floor history starts after the first live coverage snapshot. It is not backfilled from
            OpenSea.
          </p>
        ) : null}
      </section>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Mini label="24h volume" value={compact(metrics.volume24h)} />
        <Mini label="7d volume" value={compact(metrics.volume7d)} />
        <Mini label="30d volume" value={compact(metrics.volume30d)} />
        <Mini label="Listed" value={pct(listedPct)} />
        <Mini label="Owners" value={metrics.owners.toLocaleString()} />
        <Mini label="24h sales" value={metrics.sales24h.toLocaleString()} />
        <Mini label="7d sales" value={metrics.sales7d.toLocaleString()} />
        <Mini label="30d sales" value={metrics.sales30d.toLocaleString()} />
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-eyebrow-muted">{label}</span>
      <span className="text-numeral text-xl font-semibold">{value}</span>
    </div>
  );
}

function FloorSparkline({ points }: { points: FloorSnapshot[] }) {
  const values = points.map((p) => p.floor).filter((n): n is number => n !== null);
  if (values.length < 2) {
    return <div className="h-24 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 40 - ((v - min) / span) * 36;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" className="h-24 w-full text-[var(--color-net-green)]">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
