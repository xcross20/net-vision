'use client';

import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { CategoryMetrics } from '@/lib/market';
import { compact, payment, pct } from '@/lib/format';
import { CategoryGlyph } from '@/components/showroom/CategoryGlyph';

export function CategoryCard({
  metrics,
  movement,
  rank,
}: {
  metrics: CategoryMetrics;
  movement?: number | null;
  rank?: number;
}) {
  const floor = metrics.floorPrice;
  const movementLabel =
    movement !== undefined && movement !== null ? pct(movement) : null;
  const movementTone =
    movement !== undefined && movement !== null
      ? movement > 0
        ? 'up'
        : movement < 0
          ? 'down'
          : 'flat'
      : null;
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className={cn(
        'group/cat nv-glass flex h-full items-center gap-4 rounded-[18px] p-4 md:p-5',
        'transition-transform duration-200 hover:-translate-y-0.5',
      )}
    >
      <CategoryGlyph metrics={metrics} size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[16px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {metrics.name}
            </span>
            <span className="text-[12px] text-[var(--color-text-tertiary)]">
              {metrics.family}
            </span>
          </div>
          {rank != null ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
              #{rank}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <MicroStat
            label="Floor"
            value={floor !== null ? payment(floor, metrics.currency) : '—'}
          />
          <MicroStat
            label="24h vol"
            value={metrics.marketStatus === 'syncing' ? '—' : compact(metrics.volume24h)}
          />
          <MicroStat
            label="7d"
            value={movementLabel ?? '—'}
            tone={movementTone}
          />
        </div>
      </div>
      <ArrowRight
        size={14}
        weight="bold"
        className="shrink-0 text-[var(--color-text-tertiary)] transition-all group-hover/cat:translate-x-0.5 group-hover/cat:text-[var(--color-net-green)]"
      />
    </Link>
  );
}

function MicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'flat' | null;
}) {
  const toneClass =
    tone === 'up'
      ? 'text-[var(--color-net-green)]'
      : tone === 'down'
        ? 'text-[var(--color-danger)]'
        : 'text-[var(--color-text-primary)]';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</span>
      <span className={cn('text-numeral text-[13px] font-semibold tracking-tight', toneClass)}>
        {value}
      </span>
    </div>
  );
}
