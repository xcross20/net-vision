import { MarketShowroom } from '@/components/v2/market/MarketShowroom';
import { listCategories } from '@/lib/data/categories';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market — Net Vision',
  description: 'Every active Button Presser listing on Robinhood Chain.',
};

export default async function MarketPage() {
  const source = getMarketSource();
  const [page, snapshot, freshness, categories] = await Promise.all([
    source.listTokens({ listedOnly: true, limit: 60 }),
    source.getCollectionSnapshot(),
    source.getFreshness(),
    listCategories().catch(() => []),
  ]);

  return (
    <MarketShowroom
      snapshot={snapshot}
      freshness={freshness}
      tokens={page.tokens}
      categories={categories}
    />
  );
}
