import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = getCategoryMetrics(slug);
  if (!metrics) {
    return NextResponse.json({ error: 'category not found' }, { status: 404 });
  }
  return NextResponse.json(metrics);
}
