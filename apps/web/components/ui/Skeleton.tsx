import { cn } from '@/lib/cn';

/**
 * Generic skeleton. Pair with the same dimensions as the real content
 * so the layout does not shift when data arrives.
 */
export function Skeleton({
  className,
  rounded = 'md',
}: {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}) {
  const r =
    rounded === 'full' ? 'rounded-full' :
    rounded === 'lg' ? 'rounded-[var(--radius-lg)]' :
    rounded === 'sm' ? 'rounded-[var(--radius-sm)]' :
    'rounded-[var(--radius-md)]';
  return <div className={cn('nv-skeleton', r, className)} aria-hidden="true" />;
}

/** Square placeholder for NFT thumbnails. */
export function AssetSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full" rounded="md" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Inline placeholder for a stat readout. */
export function MetricSkeleton({ width = 'w-24' }: { width?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className={cn('h-6', width)} />
    </div>
  );
}