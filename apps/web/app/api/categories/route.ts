import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/categories';
import { snapshotRevision } from '@/lib/index/store';
import { categoryResponse } from '@/lib/market/category-contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await listCategories();
  const revision = snapshotRevision();
  return NextResponse.json({
    snapshotRevision: revision,
    categories: categories.map((c) => categoryResponse(c, revision)),
  });
}
