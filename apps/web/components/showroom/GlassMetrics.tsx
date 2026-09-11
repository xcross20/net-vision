import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type GlassMetric = {
  label: string;
  value: string;
  icon?: ReactNode;
  delta?: string | null;
  emphasis?: boolean;
};

/**
 * Glass metric chips used inside cinematic heroes.
 * Values are passed in from live market facts — this component does not invent them.
 */
export function GlassMetrics({
  items,
  variant = 'chips',
}: {
  items: GlassMetric[];
  variant?: 'chips' | 'bar';
}) {
  if (items.length === 0) return null;
  if (variant === 'bar') {
    return (
      <div className="nv-glass grid grid-cols-2 overflow-hidden rounded-[18px] sm:grid-cols-4 xl:grid-cols-8">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              'flex min-w-0 items-center gap-3 px-4 py-3.5',
              index > 0 && 'border-t border-[var(--color-border-subtle)] sm:border-t-0 sm:border-l',
              index >= 4 && 'xl:border-t-0',
              index === 4 && 'sm:border-t xl:border-t-0',
            )}
          >
            {item.icon ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(72,235,145,0.12)] text-[var(--color-net-green)]">
                {item.icon}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  'text-numeral text-[15px] font-semibold tracking-tight md:text-[17px]',
                  item.emphasis ? 'text-[var(--color-net-green)]' : 'text-[var(--color-text-primary)]',
                )}
              >
                {item.value}
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {item.label}
              </span>
            </div>
            {item.delta ? (
              <span className="ml-auto text-numeral text-[11px] text-[var(--color-net-green)]">{item.delta}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="nv-glass inline-flex min-w-[7.5rem] items-center gap-2.5 rounded-[14px] px-3 py-2.5"
        >
          {item.icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(72,235,145,0.12)] text-[var(--color-net-green)]">
              {item.icon}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span
              className={cn(
                'text-numeral text-[15px] font-semibold tracking-tight',
                item.emphasis ? 'text-[var(--color-net-green)]' : 'text-[var(--color-text-primary)]',
              )}
            >
              {item.value}
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
