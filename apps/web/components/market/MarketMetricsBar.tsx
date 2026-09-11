import { cn } from '@/lib/cn';

export type MarketMetric = {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
};

export function MarketMetricsBar({ items }: { items: MarketMetric[] }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] sm:grid-cols-4',
        items.length > 4 && 'xl:grid-cols-8',
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'flex flex-col gap-1 px-4 py-4',
            index > 0 && 'border-t border-[var(--color-border-subtle)] sm:border-t-0 sm:border-l',
            index >= 4 && 'xl:border-t-0',
            index === 4 && 'sm:border-t xl:border-t-0',
          )}
        >
          <span className="text-eyebrow-muted">{item.label}</span>
          <span
            className={cn(
              'text-numeral text-lg font-semibold tracking-tight md:text-xl',
              item.emphasis ? 'text-[var(--color-net-green)]' : 'text-[var(--color-text-primary)]',
            )}
          >
            {item.value}
          </span>
          {item.sub ? (
            <span className="text-numeral text-[11px] text-[var(--color-text-tertiary)]">{item.sub}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
