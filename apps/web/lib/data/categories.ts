/**
 * Production category reads.
 *
 * Every metric is derived from the live MarketSource (OpenSea-backed).
 * Seed data is no longer used in production code paths. The fixtures
 * remain in `apps/web/lib/data/__fixtures__` for local UI iteration and
 * adversarial test fixtures.
 */

import { getMarketSource } from '@/lib/market';
import { VIRTUAL_COLLECTION_CATALOG, type VirtualCollectionSlug } from '@net-vision/taxonomy';
import type { CategoryMetrics, Token } from '@/lib/market';

export type { CategoryMetrics } from '@/lib/market';

export async function getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  if (!meta) return null;
  const live = await getMarketSource().getCategoryMetrics(slug);
  if (!live) return null;
  return {
    ...live,
    name: meta.name,
    family: meta.family,
    description: meta.description,
  };
}

export async function listCategories(): Promise<CategoryMetrics[]> {
  const live = await getMarketSource().listCategories();
  return live.map((c) => {
    const meta = VIRTUAL_COLLECTION_CATALOG.find((m) => m.slug === c.slug);
    return {
      ...c,
      name: meta?.name ?? c.name,
      family: meta?.family ?? c.family,
      description: meta?.description ?? c.description,
    };
  });
}

export async function listCategoryTokens(slug: string): Promise<Token[]> {
  const page = await getMarketSource().listTokens({ category: slug, limit: 60 });
  return page.tokens;
}

export type CategorySlug = VirtualCollectionSlug;
