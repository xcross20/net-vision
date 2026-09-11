import Link from 'next/link';
import { cn } from '@/lib/cn';
import { NetVisionMark } from './NetVisionMark';

export function NetVisionLogo({
  href = '/',
  size = 'nav',
  className,
}: {
  href?: string | null;
  size?: 'nav' | 'footer' | 'mark';
  className?: string;
}) {
  const markSize = size === 'footer' ? 22 : size === 'mark' ? 28 : 26;
  const inner = (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[var(--color-text-primary)]',
        size === 'nav' && 'text-[15px] font-semibold tracking-tight',
        size === 'footer' && 'text-sm font-semibold tracking-tight',
        className,
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(72,235,145,0.10)] text-[var(--color-net-green)]">
        <NetVisionMark size={markSize} />
      </span>
      {size === 'mark' ? null : <span>Net Vision</span>}
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
