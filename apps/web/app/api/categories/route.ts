import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/categories';
import { snapshotRevision } from '@/lib/index/store';
import { categoryResponse } from '@/lib/market/category-contract';
import { marketReadModel } from '@/lib/index/sql-read-flags';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await listCategories();
  const revision =
    marketReadModel() === 'sql'
      ? (await getMarketSource().getCollectionSnapshot()).snapshotRevision
      : snapshotRevision();
  return NextResponse.json({
    snapshotRevision: revision,
    categories: categories.map((c) =>
      categoryResponse(c, revision, {
        includeFloorWhileSyncing: marketReadModel() === 'sql',
      }),
    ),
  });
}
