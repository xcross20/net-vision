import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/cn';
import type { CategoryMetrics } from '@/lib/market';
import { compact, payment, pct } from '@/lib/format';
import { LiveIndicator } from './LiveIndicator';
import { CategoryGlyph } from '@/components/showroom/CategoryGlyph';

/**
 * ENS Vision inspired category list row. One row per category, with
 * Floor / Listed / Owners / 24h Volume / 7d movement on a single line.
 *
 * On mobile it collapses to two rows: name + description, then metrics
 * stacked. Tap the row to open the category page.
 */
export function CategoryRow({
  metrics,
  index,
  volumeWindow = '24h',
}: {
  metrics: CategoryMetrics;
  movement?: number | null;
  index?: number;
  volumeWindow?: '24h' | '7d' | '30d' | 'all';
}) {
  const volume =
    volumeWindow === '7d'
      ? metrics.volume7d
      : volumeWindow === '30d'
        ? metrics.volume30d
        : volumeWindow === 'all'
          ? metrics.volumeAllTracked
          : metrics.volume24h;
  const sales = volumeWindow === '24h' ? metrics.sales24h : metrics.sales7d;
  return (
    <Link
      href={`/categories/${metrics.slug}`}
      className={cn(
        'group flex flex-col gap-3 px-4 py-4 transition-colors',
        'hover:bg-[var(--color-surface-hover)] lg:gap-0 lg:px-5 lg:py-3',
      )}
    >
      <div className="flex items-start gap-3 lg:grid lg:[grid-template-columns:2.25rem_minmax(0,1.7fr)_5.5rem_6.5rem_5rem_5rem_6.5rem_5rem_5.5rem_5.5rem_6.5rem_2.5rem] lg:items-center lg:gap-x-3">
        <span className="hidden text-numeral text-[12px] text-[var(--color-text-tertiary)] lg:inline-block">
          {index ?? ''}
        </span>
        <div className="flex min-w-0 items-center gap-3">
          <CategoryGlyph metrics={metrics} size="sm" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              {metrics.name}
            </span>
          </div>
        </div>

        <span className="hidden text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] lg:inline-block">
          {metrics.family}
        </span>
        <span className="hidden text-numeral text-sm text-right text-[var(--color-text-primary)] lg:inline-block">
          {metrics.marketStatus === 'syncing'
            ? 'Syncing'
            : metrics.floorPrice !== null
              ? payment(metrics.floorPrice, metrics.currency)
              : '—'}
        </span>
        <span
          className={cn(
            'hidden text-numeral text-sm text-right lg:inline-block',
            (metrics.floorChange24h ?? 0) > 0 && 'text-[var(--color-net-green)]',
            (metrics.floorChange24h ?? 0) < 0 && 'text-[var(--color-danger)]',
          )}
        >
          {metrics.marketStatus === 'syncing' ? '—' : pct(metrics.floorChange24h)}
        </span>
        <span
          className={cn(
            'hidden text-numeral text-sm text-right lg:inline-block',
            (metrics.floorChange7d ?? 0) > 0 && 'text-[var(--color-net-green)]',
            (metrics.floorChange7d ?? 0) < 0 && 'text-[var(--color-danger)]',
          )}
        >
          {metrics.marketStatus === 'syncing' ? '—' : pct(metrics.floorChange7d)}
        </span>
        <span className="hidden text-numeral text-sm text-right text-[var(--color-text-secondary)] lg:inline-block">
          {metrics.marketStatus === 'syncing' ? '—' : compact(volume)}
        </span>
        <span className="hidden text-numeral text-sm text-right text-[var(--color-text-secondary)] lg:inline-block">
          {sales.toLocaleString()}
        </span>
        <span className="hidden text-numeral text-sm text-right text-[var(--color-text-secondary)] lg:inline-block">
          {metrics.listedCount.toLocaleString()}
        </span>
        <span className="hidden text-numeral text-sm text-right text-[var(--color-text-secondary)] lg:inline-block">
          {metrics.memberSupply.toLocaleString()}
        </span>
        <span className="hidden justify-end lg:inline-flex">
          <TrendSpark change24h={metrics.floorChange24h} change7d={metrics.floorChange7d} />
        </span>

        <span className="ml-auto hidden text-[var(--color-text-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--color-net-green)] lg:inline-flex">
          <ArrowRight size={14} weight="bold" />
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 md:hidden">
        <Cell
          label="Floor"
          value={
            metrics.marketStatus === 'syncing'
              ? 'Syncing'
              : metrics.floorPrice !== null
                ? `${metrics.floorPrice.toFixed(2)}`
                : '—'
          }
          unit={metrics.marketStatus === 'syncing' ? undefined : metrics.currency}
          emphasis
        />
        <Cell
          label={metrics.marketStatus === 'syncing' ? 'Known listed' : 'Listed'}
          value={metrics.listedCount.toLocaleString()}
        />
        <Cell label="Sales" value={metrics.sales24h.toLocaleString()} />
        <Cell label="Members" value={metrics.memberSupply.toLocaleString()} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)] md:hidden">
        <LiveIndicator
          tone={metrics.marketStatus === 'syncing' ? 'amber' : 'green'}
          size={5}
          label={metrics.marketStatus === 'syncing' ? 'Syncing' : 'Live'}
        />
        <span className="text-numeral">
          Vol 24h {metrics.marketStatus === 'syncing' ? '—' : compact(metrics.volume24h)}
        </span>
        <ArrowRight size={12} weight="bold" />
      </div>
    </Link>
  );
}

function TrendSpark({
  change24h,
  change7d,
}: {
  change24h: number | null;
  change7d: number | null;
}) {
  const a = change24h ?? 0;
  const b = change7d ?? 0;
  const up = b >= 0;
  const y0 = 14;
  const y1 = 14 - a * 40;
  const y2 = 14 - b * 40;
  const clamp = (n: number) => Math.min(22, Math.max(2, n));
  return (
    <svg width="72" height="24" viewBox="0 0 72 24" aria-hidden="true" className="overflow-visible">
      <polyline
        fill="none"
        stroke={up ? 'var(--color-net-green)' : 'var(--color-danger)'}
        strokeWidth="1.6"
        points={`2,${clamp(y0)} 36,${clamp(y1)} 70,${clamp(y2)}`}
      />
    </svg>
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
