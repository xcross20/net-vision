import { notFound } from 'next/navigation';
import { getCategoryMetrics, listCategoryTokenPage } from '@/lib/data/categories';
import { VIRTUAL_COLLECTION_CATALOG } from '@net-vision/taxonomy';
import { CategoryMarket } from '@/components/category/CategoryMarket';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return VIRTUAL_COLLECTION_CATALOG.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  return {
    title: meta ? `${meta.name} — Net Vision` : 'Category — Net Vision',
    description: meta?.description ?? 'Button Presser category on Robinhood Chain.',
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [metrics, page] = await Promise.all([
    getCategoryMetrics(slug),
    listCategoryTokenPage(slug, { status: 'listed', limit: 48, offset: 0 }),
  ]);
  if (!metrics) notFound();
  return (
    <CategoryMarket
      metrics={metrics}
      initialTokens={page.tokens}
      initialTotal={page.total}
    />
  );
}
