/**
 * Virtual collection analytics derived from the seeded tokens.
 *
 * In production these numbers come from floor_snapshots, market_orders,
 * and virtual_collection_memberships tables. For the read-only slice
 * they are computed on the fly from the deterministic seed.
 */
import { VIRTUAL_COLLECTION_CATALOG, type VirtualCollectionSlug } from '@net-vision/taxonomy';
import { getSeededTokens, getSeededTotalSupply, type SeededToken } from './seed';

export type CategoryMetrics = {
  slug: string;
  name: string;
  family: string;
  description: string;
  memberSupply: number;
  totalSupply: number;
  listedCount: number;
  floorPriceEth: number | null;
  lastSalePriceEth: number | null;
  volume24hEth: number;
};

function isMember(token: SeededToken, slug: VirtualCollectionSlug | string): boolean {
  return token.traits.some((t) => t.slug === slug);
}

export function getCategoryMetrics(slug: string): CategoryMetrics | null {
  const meta = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === slug);
  if (!meta) return null;
  const tokens = getSeededTokens();
  const members = tokens.filter((t) => isMember(t, slug));
  const listed = members.filter((t) => t.listingPriceEth !== null);
  const floors = listed
    .map((t) => (t.listingPriceEth ? Number.parseFloat(t.listingPriceEth) : null))
    .filter((n): n is number => n !== null);
  const floor = floors.length > 0 ? Math.min(...floors) : null;
  const lastSales = members
    .map((t) => (t.lastSalePriceEth ? Number.parseFloat(t.lastSalePriceEth) : null))
    .filter((n): n is number => n !== null);
  const lastSale = lastSales.length > 0 ? lastSales[lastSales.length - 1] ?? null : null;
  const volume = lastSales.reduce((a, b) => a + b, 0);

  return {
    slug: meta.slug,
    name: meta.name,
    family: meta.family,
    description: meta.description,
    memberSupply: members.length,
    totalSupply: getSeededTotalSupply(),
    listedCount: listed.length,
    floorPriceEth: floor,
    lastSalePriceEth: lastSale,
    volume24hEth: volume,
  };
}

export function listCategories(): CategoryMetrics[] {
  return VIRTUAL_COLLECTION_CATALOG.map((c) => getCategoryMetrics(c.slug)).filter(
    (m): m is CategoryMetrics => m !== null,
  );
}

export function listCategoryTokens(slug: string): SeededToken[] {
  return getSeededTokens().filter((t) => isMember(t, slug));
}
