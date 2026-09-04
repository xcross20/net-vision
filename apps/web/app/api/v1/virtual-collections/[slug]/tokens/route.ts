import { NextResponse } from 'next/server';
import { getCategoryMetrics, listCategoryTokens } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = getCategoryMetrics(slug);
  if (!metrics) {
    return NextResponse.json({ error: 'category not found' }, { status: 404 });
  }
  const tokens = listCategoryTokens(slug);
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);
  return NextResponse.json({
    category: { slug: metrics.slug, name: metrics.name },
    tokens: tokens.slice(0, limit).map((t) => ({
      tokenId: t.tokenId,
      ownerAddress: t.ownerAddress,
      imageUrl: t.imageUrl,
      listingPriceEth: t.listingPriceEth,
      lastSalePriceEth: t.lastSalePriceEth,
      traits: t.traits.map((tr) => tr.slug),
    })),
    total: tokens.length,
  });
}
