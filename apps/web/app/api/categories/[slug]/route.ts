import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { snapshotRevision } from '@/lib/index/store';
import { categoryResponse } from '@/lib/market/category-contract';
import { marketReadModel } from '@/lib/index/sql-read-flags';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  const revision =
    marketReadModel() === 'sql'
      ? (await getMarketSource().getCollectionSnapshot()).snapshotRevision
      : snapshotRevision();
  return NextResponse.json(
    categoryResponse(metrics, revision, {
      includeFloorWhileSyncing: marketReadModel() === 'sql',
    }),
  );
}
