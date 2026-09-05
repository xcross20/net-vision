import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  const sales = await getMarketSource().listCategoryTopSales(slug, 10);
  return NextResponse.json({ slug, sales, highestSale: metrics.highestSale });
}
