'use client';

import { cn } from '@/lib/cn';

/**
 * Underlined tab bar. Active state uses a layoutId-style spring
 * underline; the marker is a single absolutely-positioned span.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  size = 'md',
  className,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const py = size === 'sm' ? 'py-2' : 'py-3';
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-1 overflow-x-auto', className)}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'group relative inline-flex shrink-0 items-center gap-2 rounded-md px-3',
              py,
              'text-sm transition-colors',
              active
                ? 'text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            <span>{t.label}</span>
            {typeof t.count === 'number' ? (
              <span
                className={cn(
                  'text-numeral text-[11px]',
                  active ? 'text-[var(--color-net-green)]' : 'text-[var(--color-text-tertiary)]',
                )}
              >
                {t.count.toLocaleString()}
              </span>
            ) : null}
            {active ? (
              <span
                className="absolute inset-x-2 -bottom-px h-px bg-[var(--color-net-green)]"
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}