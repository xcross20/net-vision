import { NextResponse } from 'next/server';
import { listCategoryTokenPage } from '@/lib/data/categories';

export const dynamic = 'force-dynamic';

function optionalNumber(raw: string | null): number {
  if (raw == null || raw.trim() === '') return Number.NaN;
  return Number(raw);
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 48, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const material = url.searchParams.get('material');
  const pattern = url.searchParams.get('pattern');
  const q = url.searchParams.get('q')?.trim() ?? '';
  // Number(null) === 0 — never treat a missing param as a real bound.
  const minPrice = optionalNumber(url.searchParams.get('minPrice'));
  const maxPrice = optionalNumber(url.searchParams.get('maxPrice'));
  const page = await listCategoryTokenPage(slug, {
    status: 'listed',
    limit,
    offset,
  });
  const filtered = page.tokens.filter((token) => {
    const traits = token.traits ?? [];
    if (material && !traits.some((t) => t.slug === material)) return false;
    if (pattern && !traits.some((t) => t.slug === pattern)) return false;
    if (q && !token.tokenId.includes(q) && !(token.name ?? '').toLowerCase().includes(q.toLowerCase())) {
      return false;
    }
    if (Number.isFinite(minPrice) && (token.listingPrice === null || token.listingPrice < minPrice)) {
      return false;
    }
    if (Number.isFinite(maxPrice) && (token.listingPrice === null || token.listingPrice > maxPrice)) {
      return false;
    }
    return true;
  });
  // When no client-side filters are active, trust the source total/pagination.
  const filtering = Boolean(material || pattern || q || Number.isFinite(minPrice) || Number.isFinite(maxPrice));
  const total = filtering ? filtered.length + offset : page.total;
  const nextOffset = filtering
    ? offset + filtered.length < total
      ? offset + filtered.length
      : null
    : offset + page.tokens.length < page.total
      ? offset + page.tokens.length
      : null;
  return NextResponse.json({
    tokens: filtering ? filtered : page.tokens,
    total,
    limit,
    offset,
    nextOffset,
  });
}
