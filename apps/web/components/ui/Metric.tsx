import { cn } from '@/lib/cn';

/**
 * A single statistical readout. Intentionally borderless so the row of
 * metrics on the homepage reads as one continuous information strip
 * rather than four isolated boxes.
 */
export function Metric({
  label,
  value,
  sub,
  emphasis,
  size = 'md',
  align = 'left',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  emphasis?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'right';
}) {
  const valueSize =
    size === 'xl' ? 'text-4xl md:text-5xl' :
    size === 'lg' ? 'text-2xl md:text-3xl' :
    size === 'md' ? 'text-xl md:text-2xl' :
    'text-base md:text-lg';

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 min-w-0',
        align === 'right' ? 'items-end text-right' : 'items-start text-left',
      )}
    >
      <span className="text-label">{label}</span>
      <span
        className={cn(
          'text-numeral font-semibold tracking-tight',
          valueSize,
          emphasis ? 'text-[var(--color-net-green)]' : 'text-[var(--color-text-primary)]',
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-numeral text-xs text-[var(--color-text-tertiary)]">{sub}</span>
      ) : null}
    </div>
  );
}