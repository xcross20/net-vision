import { listCategories } from '@/lib/data/categories';
import { CategoriesDirectory } from '@/components/category/CategoriesDirectory';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Categories — Net Vision',
  description: 'Every Button Presser category ranked as its own live market.',
};

export default async function CategoriesPage() {
  const categories = await listCategories();
  return <CategoriesDirectory categories={categories} />;
}
