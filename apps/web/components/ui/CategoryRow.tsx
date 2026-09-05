import Link from 'next/link';
import { ArrowRight, Star } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { CategoryMetrics } from '@/lib/market';
import { compact, payment, pct } from '@/lib/format';
import { LiveIndicator } from './LiveIndicator';

/**
 * ENS Vision inspired category list row. One row per category, with
 * Floor / Listed / Owners / 24h Volume / 7d movement on a single line.
 *
 * On mobile it collapses to two rows: name + description, then metrics
 * stacked. Tap the row to open the category page.
 */
export function CategoryRow({
  metrics,
  movement,
}: {
  metrics: CategoryMetrics;
  movement?: number | null;
}) {
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
        'group flex flex-col gap-3 px-4 py-4 transition-colors',
        'hover:bg-[var(--color-surface-hover)] md:gap-0 md:px-6 md:py-3',
      )}
    >
      <div className="flex items-start gap-3 md:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-net-green)] transition-transform group-hover:rotate-12">
          <Star size={14} weight="duotone" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            {metrics.name}
          </span>
          <span className="truncate text-[12px] text-[var(--color-text-tertiary)]">
            {metrics.description}
          </span>
        </div>

        <span className="hidden text-numeral text-sm text-[var(--color-text-primary)] md:inline-block md:w-24 md:text-right">
          {metrics.floorPrice !== null ? payment(metrics.floorPrice, metrics.currency) : '—'}
        </span>
        <span className="hidden text-numeral text-sm text-[var(--color-text-secondary)] md:inline-block md:w-20 md:text-right">
          {metrics.memberSupply.toLocaleString()}
        </span>
        <span className="hidden text-numeral text-sm text-[var(--color-text-secondary)] md:inline-block md:w-16 md:text-right">
          {metrics.listedCount.toLocaleString()}
        </span>
        <span className="hidden text-numeral text-sm text-[var(--color-text-secondary)] md:inline-block md:w-20 md:text-right">
          {metrics.owners.toLocaleString()}
        </span>
        <span className="hidden text-numeral text-sm text-[var(--color-text-secondary)] md:inline-block md:w-24 md:text-right">
          {compact(metrics.volume24hNative)} ETH
        </span>
        <span
          className={cn(
            'hidden text-numeral text-sm md:inline-block md:w-20 md:text-right',
            movementTone === 'up' && 'text-[var(--color-net-green)]',
            movementTone === 'down' && 'text-[var(--color-danger)]',
            (!movementTone || movementTone === 'flat') && 'text-[var(--color-text-tertiary)]',
          )}
        >
          {movement !== undefined && movement !== null ? pct(movement) : '—'}
        </span>

        <span className="ml-2 hidden text-[var(--color-text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-net-green)] md:inline-flex">
          <ArrowRight size={12} weight="bold" />
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 md:hidden">
        <Cell label="Floor" value={metrics.floorPrice !== null ? `${metrics.floorPrice.toFixed(2)}` : '—'} unit={metrics.currency} emphasis />
        <Cell label="Members" value={metrics.memberSupply.toLocaleString()} />
        <Cell label="Listed" value={metrics.listedCount.toLocaleString()} />
        <Cell label="Owners" value={metrics.owners.toLocaleString()} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)] md:hidden">
        <LiveIndicator tone="green" size={5} label="Live" />
        <span className="text-numeral">
          Vol 24h {compact(metrics.volume24hNative)} ETH
        </span>
        <ArrowRight size={12} weight="bold" />
      </div>
    </Link>
  );
}

function Cell({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string;
  value: string;
  unit?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-eyebrow-muted">{label}</span>
      <span
        className={cn(
          'text-numeral text-[13px] font-semibold tracking-tight',
          emphasis ? 'text-[var(--color-net-green)]' : 'text-[var(--color-text-primary)]',
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-[11px] text-[var(--color-text-tertiary)]">{unit}</span> : null}
      </span>
    </div>
  );
}
