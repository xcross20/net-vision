import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { snapshotRevision } from '@/lib/index/store';
import { categoryResponse } from '@/lib/market/category-contract';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  return NextResponse.json(categoryResponse(metrics, snapshotRevision()));
}
