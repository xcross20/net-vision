import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = listCategories();
  return NextResponse.json({
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      family: c.family,
      description: c.description,
      memberSupply: c.memberSupply,
      listedCount: c.listedCount,
      floorPriceEth: c.floorPriceEth,
      lastSalePriceEth: c.lastSalePriceEth,
    })),
  });
}
