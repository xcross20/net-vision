import { NextResponse } from 'next/server';
import { getToken } from '@/lib/data/tokens';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await ctx.params;
  const token = await getToken(tokenId);
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
    rarityRank: token.rarityRank,
    contractAddress: token.contractAddress,
    chainId: token.chainId,
  });
}
