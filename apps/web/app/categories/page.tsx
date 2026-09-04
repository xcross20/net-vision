import { listCategories } from '@/lib/data/categories';
import { CategoryCard } from '@/components/CategoryCard';

export const metadata = {
  title: 'Categories — Net Vision',
  description: 'Algorithmic virtual collections for Button Presser numbers.',
};

export default function CategoriesPage() {
  const categories = listCategories();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="nv-section-title">Virtual collections</span>
        <h1 className="text-2xl md:text-3xl font-semibold">Categories</h1>
        <p className="text-[var(--nv-muted)] max-w-2xl">
          Every Button Presser token belongs to one or more categories below. Categories are
          computed deterministically from the token number and a versioned taxonomy; the same
          number always produces the same classification.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((c) => (
          <CategoryCard key={c.slug} metrics={c} />
        ))}
      </div>
    </div>
  );
}
