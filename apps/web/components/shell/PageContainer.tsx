import { cn } from '@/lib/cn';

const SIZE_CLASS = {
  standard: 'max-w-[var(--content-standard)]',
  wide: 'max-w-[var(--content-max)]',
  cinematic: 'max-w-[var(--content-wide)]',
} as const;

export type PageContainerSize = keyof typeof SIZE_CLASS;

export function PageContainer({
  size = 'wide',
  className,
  children,
}: {
  size?: PageContainerSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full px-4 md:px-8', SIZE_CLASS[size], className)}>
      {children}
    </div>
  );
}
