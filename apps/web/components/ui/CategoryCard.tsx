'use client';

import Link from 'next/link';
import { ArrowRight, Sparkle } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { CategoryMetrics } from '@/lib/market';
import { compact, payment, pct } from '@/lib/format';
import { LiveIndicator } from './LiveIndicator';

/**
 * Homepage category card. Designed as a featured compact tile, not a
 * dense row. Shows: name, floor, listed count, and a 7-day movement
 * indicator. Card surface is intentionally minimal; the surrounding
 * negative space carries the weight.
 *
 * No motion / animation library: the hover lift is a CSS transition
 * so the component stays render-safe when bundled into server pages.
 */
export function CategoryCard({
  metrics,
  movement,
}: {
  metrics: CategoryMetrics;
  /** Pre-computed fractional 7-day floor move. Positive = up. */
  movement?: number | null;
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
    <div className="group/cat h-full transition-transform duration-200 hover:-translate-y-0.5">
      <Link
        href={`/categories/${metrics.slug}`}
        className={cn(
          'flex h-full flex-col gap-5 rounded-[var(--radius-lg)]',
          'bg-[var(--color-surface-1)] p-5 md:p-6',
          'transition-colors hover:bg-[var(--color-surface-2)]',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-eyebrow-muted">
              {metrics.family}
            </span>
            <span className="truncate text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
              {metrics.name}
            </span>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(72,235,145,0.10)] text-[var(--color-net-green)] transition-transform group-hover/cat:rotate-12">
            <Sparkle size={14} weight="duotone" />
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-eyebrow-muted">Floor</span>
          <span className="text-numeral text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            {floor !== null ? payment(floor, metrics.currency) : '—'}
          </span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-4 border-t border-[var(--color-border-subtle)] pt-4">
          <MicroStat
            label={metrics.marketStatus === 'syncing' ? 'Known listed' : 'Listed'}
            value={compact(metrics.listedCount)}
          />
          <MicroStat
            label="7d move"
            value={movementLabel ?? '—'}
            tone={movementTone}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
          <LiveIndicator
            tone={metrics.marketStatus === 'live' ? 'green' : 'amber'}
            size={5}
            label={metrics.marketStatus === 'live' ? 'Live' : 'Syncing'}
          />
          <ArrowRight
            size={12}
            weight="bold"
            className="text-[var(--color-text-tertiary)] transition-all group-hover/cat:translate-x-0.5 group-hover/cat:text-[var(--color-net-green)]"
          />
        </div>
      </Link>
    </div>
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
      <span className="text-eyebrow-muted">{label}</span>
      <span className={cn('text-numeral text-sm font-semibold tracking-tight', toneClass)}>
        {value}
      </span>
    </div>
  );
}
