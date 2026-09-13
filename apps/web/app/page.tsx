import { MarketShowroom } from '@/components/v2/market/MarketShowroom';
import { listCategories } from '@/lib/data/categories';
import { getCollectionSnapshot, listTokens } from '@/lib/data/tokens';
import { getMarketSource } from '@/lib/market';
import { baseCollectionSnapshot } from '@/lib/market/collection-facts';

export const dynamic = 'force-dynamic';

async function settle<T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await promise };
  } catch {
    return { ok: false };
  }
}

export default async function HomePage() {
  const [snapshotRaw, tokensLoad, categoriesLoad, freshness] = await Promise.all([
    getCollectionSnapshot().catch(() => null),
    settle(listTokens({ listedOnly: true, limit: 48 })),
    settle(listCategories()),
    getMarketSource()
      .getFreshness()
      .catch(() => ({
        fresh: false,
        refreshedAt: null as number | null,
        source: 'cache' as const,
        resolvedChainSlug: null as string | null,
      })),
  ]);

  return (
    <MarketShowroom
      snapshot={snapshotRaw ?? baseCollectionSnapshot()}
      freshness={freshness}
      tokens={tokensLoad.ok ? tokensLoad.value : []}
      categories={categoriesLoad.ok ? categoriesLoad.value : []}
      unavailable={!tokensLoad.ok}
    />
  );
}
