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
        'inline-flex items-center gap-2.5 text-[var(--color-text-primary)]',
        size === 'nav' && 'text-[15px] font-bold tracking-[0.14em]',
        size === 'footer' && 'text-sm font-bold tracking-[0.14em]',
        className,
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[rgba(72,235,145,0.12)] text-[var(--color-net-green)] nv-glow">
        <NetVisionMark size={markSize} />
      </span>
      {size === 'mark' ? null : <span className="uppercase">Net Vision</span>}
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
