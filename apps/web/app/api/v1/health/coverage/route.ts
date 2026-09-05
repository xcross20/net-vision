import { NextResponse } from 'next/server';
import { getMarketSource } from '@/lib/market';
import { workerCheckpoint } from '@/lib/index/store';
import { isIndexerRunning } from '@/lib/index/worker';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await getMarketSource().listCategories();
  const worker = workerCheckpoint();
  return NextResponse.json({
    indexerRunning: isIndexerRunning(),
    worker,
    categories: categories.map((c) => ({
      slug: c.slug,
      memberCount: c.memberSupply,
      listedCount: c.listedCount,
      verifiedCount: c.verifiedCount,
      unknownCount: c.unknownCount,
      coveragePercent: c.coveragePercent,
      marketStatus: c.marketStatus,
      floor: c.marketStatus === 'live' ? c.floorPrice : null,
    })),
  });
}
