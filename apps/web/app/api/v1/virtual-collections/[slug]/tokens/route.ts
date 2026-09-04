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
    tokens: tokens.map((t: { tokenId: string; ownerAddress: string | null; imageUrl: string; listingPriceEth: string | null; lastSalePriceEth: string | null; traits: { slug: string }[] }) => ({
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
