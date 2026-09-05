import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/categories';
import { categoryResponse } from '@/lib/market/category-contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await listCategories();
  const ranked = [...categories].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8);
  return NextResponse.json({
    categories: ranked.map((c) => ({
      ...categoryResponse(c),
      trendingScore: c.trendingScore,
    })),
  });
}
