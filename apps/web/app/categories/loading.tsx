import { Skeleton } from '@/components/ui/Skeleton';

export default function CategoriesLoading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading categories">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" rounded="md" />
        ))}
      </div>
    </div>
  );
}
