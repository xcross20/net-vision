import { listCategories } from '@/lib/data/categories';
import { CategoriesDirectory } from '@/components/category/CategoriesDirectory';
import { getCollectionSnapshot } from '@/lib/data/tokens';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Categories — Net Vision',
  description: 'Every Button Presser category ranked as its own live market.',
};

export default async function CategoriesPage() {
  const [categories, snapshot] = await Promise.all([
    listCategories(),
    getCollectionSnapshot().catch(() => null),
  ]);
  return <CategoriesDirectory categories={categories} snapshot={snapshot} />;
}
