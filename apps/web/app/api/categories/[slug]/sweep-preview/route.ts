import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';
import { parseSweepPreviewInput } from '@/lib/market/engine';

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
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let input;
  try {
    input = parseSweepPreviewInput(body);
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_sweep', message: err instanceof Error ? err.message : 'Invalid sweep' },
      { status: 400 },
    );
  }
  try {
    const preview = await getMarketSource().previewSweep(slug, input);
    return NextResponse.json({
      ...preview,
      previewId: `sweep:${slug}:${preview.generatedAt ?? Date.now()}`,
      categorySlug: slug,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'sweep_failed', message: err instanceof Error ? err.message : 'Sweep preview failed' },
      { status: 400 },
    );
  }
}
