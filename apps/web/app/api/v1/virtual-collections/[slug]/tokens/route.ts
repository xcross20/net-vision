import { NextResponse } from 'next/server';
import { listCategoryTokens } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);
  const tokens = (await listCategoryTokens(slug)).slice(0, limit);
  return NextResponse.json({
    category: { slug },
    tokens: tokens.map((t) => ({
      tokenId: t.tokenId,
      ownerAddress: t.ownerAddress,
      imageUrl: t.imageUrl,
      listingPrice: t.listingPrice,
      currency: t.currency,
      lastSalePrice: t.lastSalePrice,
      traits: t.traits.map((tr) => tr.slug),
    })),
    total: tokens.length,
  });
}
