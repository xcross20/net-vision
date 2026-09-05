import { cn } from '@/lib/cn';
import { eth, usd } from '@/lib/format';

/**
 * Price display used in cards, rows, and detail pages. Accepts an
 * optional secondary currency (USDG) shown as a smaller companion
 * under the primary ETH value.
 */
export function Price({
  ethValue,
  usdValue,
  size = 'md',
  align = 'left',
  dim,
}: {
  ethValue: number | null | undefined;
  usdValue?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  align?: 'left' | 'right';
  dim?: boolean;
}) {
  const sz =
    size === 'xl' ? 'text-3xl md:text-4xl' :
    size === 'lg' ? 'text-xl md:text-2xl' :
    size === 'md' ? 'text-base md:text-lg' :
    'text-sm';

  return (
    <div className={cn(
      'flex flex-col gap-0.5 min-w-0',
      align === 'right' ? 'items-end text-right' : 'items-start text-left',
    )}>
      <span
        className={cn(
          'text-numeral font-semibold tracking-tight',
          sz,
          dim ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]',
        )}
      >
        {eth(ethValue)}
      </span>
      {usdValue !== undefined && usdValue !== null ? (
        <span className="text-numeral text-xs text-[var(--color-text-tertiary)]">
          {usd(usdValue)}
        </span>
      ) : null}
    </div>
  );
}