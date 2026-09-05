import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await listCategories();
  return NextResponse.json({
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      family: c.family,
      description: c.description,
      memberSupply: c.memberSupply,
      listedCount: c.listedCount,
      floorPrice: c.floorPrice,
      currency: c.currency,
      lastSalePrice: c.lastSalePrice,
      topOfferPrice: c.topOfferPrice,
      topSalePrice: c.topSalePrice,
      volume24hNative: c.volume24hNative,
      volume7dNative: c.volume7dNative,
      sales24h: c.sales24h,
      sales7d: c.sales7d,
    })),
  });
}
