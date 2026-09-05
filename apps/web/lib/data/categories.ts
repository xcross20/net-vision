/**
 * Production category reads.
 *
 * Every metric is derived from the live MarketSource (OpenSea-backed).
 * Seed data is no longer used in production code paths. The fixtures
 * remain in `apps/web/lib/data/__fixtures__` for local UI iteration and
 * adversarial test fixtures.
 */

import { getMarketSource } from '@/lib/market';
import {
  VIRTUAL_COLLECTION_CATALOG,
  enumerateMembers,
  type VirtualCollectionSlug,
} from '@net-vision/taxonomy';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import type {
  CategoryMetrics,
  ListTokensPage,
  Token,
  TokenListingStatus,
} from '@/lib/market';

export type { CategoryMetrics } from '@/lib/market';

export type ListCategoryTokensOptions = {
  /** Sub-filter facet values, e.g. `palindrome:digits-3`. */
  facets?: string[];
  /** Listing status shown in the category UI. */
  status?: TokenListingStatus;
  /** Page size. */
  limit?: number;
  /** Number of matching results to skip. */
  offset?: number;
};

/**
 * Build a deterministic fallback CategoryMetrics when the live market
 * source returns null (e.g. OPENSEA_API_KEY unset, chain discovery
 * failed, or no listings yet). The fallback still reflects the true
 * deterministic member supply so the UI never 404s on a real category.
 */
function fallbackCategoryMetrics(slug: string): CategoryMetrics | null {
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  if (!meta) return null;
  const members = enumerateMembers(slug, {
    minTokenId: BUTTON_PRESSER_COLLECTION.minTokenId,
    maxTokenId: BUTTON_PRESSER_COLLECTION.maxTokenId,
  });
  const subFilter =
    slug === 'palindrome' && members.byDigitCount
      ? {
          facets: [2, 3, 4, 5].map((digits) => ({
            value: `digits-${digits}`,
            label: `${digits} Digit`,
            memberCount: members.byDigitCount![digits as 2 | 3 | 4 | 5]?.length ?? 0,
            listedCount: 0,
          })),
        }
      : undefined;
  return {
    slug,
    name: meta.name,
    family: meta.family,
    description: meta.description,
    memberSupply: members.count,
    filteredMemberSupply: members.count,
    totalSupply: BUTTON_PRESSER_COLLECTION.maxTokenId,
    listedCount: 0,
    owners: 0,
    currency: 'USDG',
    floorPrice: null,
    ceilingPrice: null,
    lastSalePrice: null,
    topOfferPrice: null,
    topSalePrice: null,
    volume24hNative: 0,
    volume7dNative: 0,
    sales24h: 0,
    sales7d: 0,
    subFilter,
  };
}

export async function getCategoryMetrics(slug: string): Promise<CategoryMetrics | null> {
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  if (!meta) return null;
  const live = await getMarketSource().getCategoryMetrics(slug);
  if (!live) return fallbackCategoryMetrics(slug);
  return {
    ...live,
    name: meta.name,
    family: meta.family,
    description: meta.description,
  };
}

export async function listCategories(): Promise<CategoryMetrics[]> {
  const live = await getMarketSource().listCategories();
  const liveSlugs = new Set(live.map((c) => c.slug));
  const allSlugs = VIRTUAL_COLLECTION_CATALOG.map((c) => c.slug);
  const missing = allSlugs.filter((slug) => !liveSlugs.has(slug));
  const fallbacks = missing
    .map((slug) => fallbackCategoryMetrics(slug))
    .filter((m): m is CategoryMetrics => m !== null);
  const merged = [...live, ...fallbacks];
  return merged.map((c) => {
    const meta = VIRTUAL_COLLECTION_CATALOG.find((m) => m.slug === c.slug);
    return {
      ...c,
      name: meta?.name ?? c.name,
      family: meta?.family ?? c.family,
      description: meta?.description ?? c.description,
    };
  });
}

export async function listCategoryTokenPage(
  slug: string,
  options: ListCategoryTokensOptions = {},
): Promise<ListTokensPage> {
  return getMarketSource().listTokens({
    category: slug,
    facets: options.facets,
    status: options.status,
    limit: options.limit ?? 200,
    offset: options.offset ?? 0,
  });
}

export async function listCategoryTokens(
  slug: string,
  options: ListCategoryTokensOptions = {},
): Promise<Token[]> {
  const page = await listCategoryTokenPage(slug, options);
  return page.tokens;
}

export type CategorySlug = VirtualCollectionSlug;
