import { NextResponse } from 'next/server';
import { listCategoryTokenPage } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 24;

function parseDigits(raw: string | null): number[] {
  if (!raw) return [];
  return [...new Set(raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => n === 2 || n === 3 || n === 4 || n === 5))]
    .sort((a, b) => a - b);
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get('limit'));
  const requestedOffset = Number(url.searchParams.get('offset'));
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(
    Number.isFinite(requestedOffset) ? Math.trunc(requestedOffset) : 0,
    0,
  );
  const activeDigits = parseDigits(url.searchParams.get('digits'));
  const facets = activeDigits.length > 0 ? activeDigits.map((d) => `digits-${d}`) : undefined;
  const status = url.searchParams.get('status');
  const listingStatus = status === 'not-listed' ? 'not-listed' : 'listed';
  const tokenPage = await listCategoryTokenPage(slug, {
    facets,
    status: listingStatus,
    limit: MAX_LIMIT,
  });
  const page = tokenPage.tokens.slice(offset, offset + limit);
  return NextResponse.json({
    category: { slug, status: listingStatus },
    tokens: page.map((t) => ({
      tokenId: t.tokenId,
      ownerAddress: t.ownerAddress,
      imageUrl: t.imageUrl,
      listingPrice: t.listingPrice,
      currency: t.currency,
      lastSalePrice: t.lastSalePrice,
      rarityRank: t.rarityRank,
      listedAt: t.listedAt,
      lastSaleAt: t.lastSaleAt,
      contractAddress: t.contractAddress,
      chainId: t.chainId,
      name: t.name,
      traits: t.traits.map((tr) => ({ slug: tr.slug, family: tr.family, label: tr.label })),
    })),
    total: tokenPage.total,
    limit,
    offset,
    nextOffset: offset + page.length < tokenPage.total ? offset + page.length : null,
  });
}
