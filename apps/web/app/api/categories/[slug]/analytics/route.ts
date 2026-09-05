import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';
import { categoryResponse } from '@/lib/market/category-contract';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  const history = await getMarketSource().floorHistory(slug);
  return NextResponse.json({
    ...categoryResponse(metrics),
    floorHistory: history,
    trackedSince: metrics.trackedSince,
  });
}
