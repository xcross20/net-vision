import { AssetSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function CategoryDetailLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading category">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <AssetSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
