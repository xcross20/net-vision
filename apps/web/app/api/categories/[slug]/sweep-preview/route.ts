import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  if (metrics.marketStatus === 'syncing') {
    return NextResponse.json(
      { error: 'sweep_disabled', message: 'Sweep waits until market coverage is live.' },
      { status: 409 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    quantity?: number;
    maxSpend?: number;
    maxPricePerItem?: number;
  };
  const preview = await getMarketSource().previewSweep(slug, {
    quantity: body.quantity,
    maxSpend: body.maxSpend,
    maxPricePerItem: body.maxPricePerItem,
  });
  return NextResponse.json(preview);
}
