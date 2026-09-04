import { NextResponse } from 'next/server';
import { getSeededToken } from '@/lib/data/seed';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await ctx.params;
  const token = getSeededToken(tokenId);
  if (!token) {
    return NextResponse.json({ error: 'token not found' }, { status: 404 });
  }
  return NextResponse.json({
    tokenId: token.tokenId,
    ownerAddress: token.ownerAddress,
    imageUrl: token.imageUrl,
    listingPriceEth: token.listingPriceEth,
    lastSalePriceEth: token.lastSalePriceEth,
    traits: token.traits.map((t) => ({
      slug: t.slug,
      family: t.family,
      label: t.label,
    })),
  });
}
