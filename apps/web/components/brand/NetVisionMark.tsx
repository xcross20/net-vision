import { cn } from '@/lib/cn';

/**
 * Net Vision diamond / split-N mark. Replaces the generic Hexagon.
 * Color via currentColor so lockups can be green or white.
 */
export function NetVisionMark({
  size = 28,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M16 2.2 5.2 16 16 29.8 9.4 16 16 2.2Z"
        fill="currentColor"
        opacity="0.42"
      />
      <path d="M16 2.2 26.8 16 16 29.8 22.6 16 16 2.2Z" fill="currentColor" />
      <path
        d="M16 6.4 12.05 16 16 25.6 19.95 16 16 6.4Z"
        fill="var(--color-bg)"
      />
    </svg>
  );
}
