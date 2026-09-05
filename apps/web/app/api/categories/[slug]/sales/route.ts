import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';
import type { SalesWindow } from '@/lib/market/source';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  const url = new URL(request.url);
  const window = (url.searchParams.get('window') ?? 'all') as SalesWindow;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 40, 1), 200);
  const sales = await getMarketSource().listCategorySales(slug, { window, limit });
  return NextResponse.json({
    slug,
    window,
    trackedSince: metrics.trackedSince,
    volume:
      window === '24h'
        ? metrics.volume24h
        : window === '7d'
          ? metrics.volume7d
          : window === '30d'
            ? metrics.volume30d
            : metrics.volumeAllTracked,
    salesCount:
      window === '24h'
        ? metrics.sales24h
        : window === '7d'
          ? metrics.sales7d
          : window === '30d'
            ? metrics.sales30d
            : sales.length,
    averageSale: metrics.averageSale,
    medianSale: metrics.medianSale,
    highestSale: metrics.highestSale,
    sales,
  });
}
