import { listCategories } from '@/lib/data/categories';
import { getCollectionSnapshot, listTokens } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { HomeHero, HomeCategories, HomeMarket } from '@/components/home';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [snapshot, tokens, allCategories, freshness] = await Promise.all([
    getCollectionSnapshot(),
    listTokens({ listedOnly: true, limit: 8 }),
    listCategories(),
    getMarketSource().getFreshness(),
  ]);

  const categories = allCategories.filter((c) => c.memberSupply > 0).slice(0, 6);

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <HomeHero snapshot={snapshot} freshness={freshness} />
      <HomeCategories categories={categories} />
      <HomeMarket tokens={tokens} />
    </div>
  );
}