import { NextResponse } from 'next/server';
import { getCategoryMetrics } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const metrics = await getCategoryMetrics(slug);
  if (!metrics) return NextResponse.json({ error: 'category not found' }, { status: 404 });
  const offers = await getMarketSource().listCategoryOffers(slug, 40);
  const aggregate = offers.reduce((sum, offer) => sum + offer.price, 0);
  return NextResponse.json({
    slug,
    offerCount: offers.length,
    aggregateOfferValue: aggregate,
    bestOffer: metrics.topOfferPrice,
    offers,
  });
}
