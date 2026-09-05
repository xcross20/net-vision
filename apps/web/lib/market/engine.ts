/**
 * Category market engine: overlapping sales attribution, windowed
 * stats, deterministic trending, and floor-sweep preview.
 *
 * History is only what we persisted. Windows of empty data stay empty.
 */
import type { TokenFacet } from '@net-vision/taxonomy';
import { CURRENT_TAXONOMY_VERSION } from '@net-vision/taxonomy';
import type { CatalogListing, CatalogSale } from './catalog';
import type { Offer } from './source';

export const MS_HOUR = 60 * 60 * 1000;
export const MS_DAY = 24 * MS_HOUR;

export type SaleEvent = CatalogSale & {
  saleEventId: string;
  marketplace: string;
  ingestedAt: number;
};

export type SaleAttribution = {
  saleEventId: string;
  tokenId: string;
  categorySlug: string;
  taxonomyVersion: string;
  facetSource: TokenFacet['source'];
  attributedPrice: number;
  occurredAt: number;
};

export type FloorSnapshot = {
  at: number;
  floor: number | null;
  listed: number;
};

export type HighestSale = {
  tokenId: string;
  price: number;
  occurredAt: number;
  currency: string;
};

export type CategoryMarketStats = {
  slug: string;
  listedCount: number;
  listedPercentage: number;
  floorPrice: number | null;
  highestAsk: number | null;
  medianAsk: number | null;
  bestOffer: number | null;
  offerCount: number;
  sales24h: number;
  sales7d: number;
  sales30d: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volumeAllTracked: number;
  averageSale: number | null;
  medianSale: number | null;
  highestSale: HighestSale | null;
  owners: number;
  floorChange24h: number | null;
  floorChange7d: number | null;
  floorChange30d: number | null;
  updatedAt: number;
  trackedSince: number;
};

export type TrendingComponents = {
  volumeAcceleration: number;
  salesAcceleration: number;
  floorMovement: number;
  offerGrowth: number;
  listingVelocity: number;
};

export type SweepPreviewItem = {
  tokenId: string;
  price: number;
  currency: string;
  orderHash: string | null;
};

export type SweepPreviewInput = {
  quantity?: number | null;
  maxSpend?: number | null;
  maxPricePerItem?: number | null;
};

export type SweepPreview = {
  strategy: 'floor';
  items: SweepPreviewItem[];
  count: number;
  total: number;
  currency: string;
  truncated: boolean;
};

export function saleEventId(sale: CatalogSale): string {
  if (sale.orderHash) return `sale:${sale.orderHash}:${sale.tokenId}`;
  return `sale:${sale.tokenId}:${sale.occurredAt}:${sale.price}`;
}

export function attributeSale(
  sale: CatalogSale,
  facets: TokenFacet[],
  taxonomyVersion = `taxonomy-${CURRENT_TAXONOMY_VERSION}`,
): SaleAttribution[] {
  const saleEventIdValue = saleEventId(sale);
  const seen = new Set<string>();
  const rows: SaleAttribution[] = [];
  for (const facet of facets) {
    if (seen.has(facet.slug)) continue;
    seen.add(facet.slug);
    rows.push({
      saleEventId: saleEventIdValue,
      tokenId: sale.tokenId,
      categorySlug: facet.slug,
      taxonomyVersion,
      facetSource: facet.source,
      attributedPrice: sale.price,
      occurredAt: sale.occurredAt,
    });
  }
  return rows;
}

function inWindow(occurredAt: number, now: number, windowMs: number): boolean {
  return occurredAt * 1000 >= now - windowMs && occurredAt * 1000 <= now;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const even = sorted.length % 2 === 0;
  const a = sorted[mid];
  const b = sorted[mid - 1];
  if (a === undefined) return null;
  if (even && b !== undefined) return (a + b) / 2;
  return a;
}

function floorChange(
  history: FloorSnapshot[],
  now: number,
  windowMs: number,
  current: number | null,
): number | null {
  if (current === null || current === 0) return null;
  const target = now - windowMs;
  const past = [...history].reverse().find((row) => row.at <= target && row.floor !== null);
  if (!past || past.floor === null || past.floor === 0) return null;
  return (current - past.floor) / past.floor;
}

export function computeCategoryMarketStats(input: {
  slug: string;
  listings: CatalogListing[];
  attributions: SaleAttribution[];
  sales: CatalogSale[];
  offers: Offer[];
  floorHistory: FloorSnapshot[];
  trackedSince: number;
  now?: number;
}): CategoryMarketStats {
  const now = input.now ?? Date.now();
  const prices = input.listings.map((row) => row.price).filter((n) => Number.isFinite(n));
  const owners = new Set(
    input.listings.map((row) => row.ownerAddress?.toLowerCase() ?? '').filter(Boolean),
  );
  const attributed = input.attributions.filter((row) => row.categorySlug === input.slug);
  const attributedSales = attributed.map((row) => ({
    price: row.attributedPrice,
    occurredAt: row.occurredAt,
    tokenId: row.tokenId,
    currency: input.sales.find((s) => saleEventId(s) === row.saleEventId)?.currency ?? 'USDG',
  }));

  const sales24h = attributedSales.filter((s) => inWindow(s.occurredAt, now, MS_DAY));
  const sales7d = attributedSales.filter((s) => inWindow(s.occurredAt, now, 7 * MS_DAY));
  const sales30d = attributedSales.filter((s) => inWindow(s.occurredAt, now, 30 * MS_DAY));
  const allPrices = attributedSales.map((s) => s.price);
  const highest = [...attributedSales].sort((a, b) => b.price - a.price)[0];
  const floorPrice = prices.length > 0 ? Math.min(...prices) : null;

  const tokenOffers = input.offers.filter((offer) =>
    input.listings.some((listing) => listing.tokenId === offer.tokenId),
  );
  const memberOffers =
    tokenOffers.length > 0
      ? tokenOffers
      : input.offers.filter((offer) => attributed.some((row) => row.tokenId === offer.tokenId));

  return {
    slug: input.slug,
    listedCount: input.listings.length,
    listedPercentage: 0,
    floorPrice,
    highestAsk: prices.length > 0 ? Math.max(...prices) : null,
    medianAsk: median(prices),
    bestOffer: memberOffers.length > 0 ? Math.max(...memberOffers.map((o) => o.price)) : null,
    offerCount: memberOffers.length,
    sales24h: sales24h.length,
    sales7d: sales7d.length,
    sales30d: sales30d.length,
    volume24h: sales24h.reduce((sum, s) => sum + s.price, 0),
    volume7d: sales7d.reduce((sum, s) => sum + s.price, 0),
    volume30d: sales30d.reduce((sum, s) => sum + s.price, 0),
    volumeAllTracked: attributedSales.reduce((sum, s) => sum + s.price, 0),
    averageSale: allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : null,
    medianSale: median(allPrices),
    highestSale: highest
      ? {
          tokenId: highest.tokenId,
          price: highest.price,
          occurredAt: highest.occurredAt,
          currency: highest.currency,
        }
      : null,
    owners: owners.size,
    floorChange24h: floorChange(input.floorHistory, now, MS_DAY, floorPrice),
    floorChange7d: floorChange(input.floorHistory, now, 7 * MS_DAY, floorPrice),
    floorChange30d: floorChange(input.floorHistory, now, 30 * MS_DAY, floorPrice),
    updatedAt: now,
    trackedSince: input.trackedSince,
  };
}

export function applyListedPercentage(
  stats: CategoryMarketStats,
  memberSupply: number,
): CategoryMarketStats {
  return {
    ...stats,
    listedPercentage: memberSupply > 0 ? stats.listedCount / memberSupply : 0,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function accel(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 1 : 0;
  return clamp01((current - previous) / previous);
}

/**
 * Floor-up alone is not trending. Volume and sales acceleration dominate.
 */
export function trendingScore(components: TrendingComponents): {
  score: number;
  components: TrendingComponents;
} {
  const score = Math.round(
    100 *
      clamp01(
        0.3 * clamp01(components.volumeAcceleration) +
          0.25 * clamp01(components.salesAcceleration) +
          0.15 * clamp01(Math.abs(components.floorMovement)) *
            (components.volumeAcceleration > 0 || components.salesAcceleration > 0 ? 1 : 0.15) +
          0.15 * clamp01(components.offerGrowth) +
          0.15 * clamp01(components.listingVelocity),
      ),
  );
  return { score, components };
}

export function trendingComponentsFromStats(input: {
  volume24h: number;
  volume7d: number;
  sales24h: number;
  sales7d: number;
  floorChange24h: number | null;
  offerCount: number;
  listedCount: number;
  memberSupply: number;
}): TrendingComponents {
  const priorVolume = Math.max(input.volume7d - input.volume24h, 0) / 6;
  const priorSales = Math.max(input.sales7d - input.sales24h, 0) / 6;
  return {
    volumeAcceleration: accel(input.volume24h, priorVolume),
    salesAcceleration: accel(input.sales24h, priorSales),
    floorMovement: input.floorChange24h ?? 0,
    offerGrowth: clamp01(input.offerCount / 20),
    listingVelocity: clamp01(input.listedCount / Math.max(input.memberSupply, 1)),
  };
}

export const SWEEP_CART_CAP = 20;

export function previewFloorSweep(
  listings: CatalogListing[],
  input: SweepPreviewInput,
): SweepPreview {
  const maxPrice = input.maxPricePerItem ?? Number.POSITIVE_INFINITY;
  const quantity = input.quantity && input.quantity > 0 ? Math.min(input.quantity, SWEEP_CART_CAP) : null;
  const maxSpend = input.maxSpend && input.maxSpend > 0 ? input.maxSpend : null;
  const sorted = [...listings]
    .filter((row) => Number.isFinite(row.price) && row.price <= maxPrice)
    .sort((a, b) => a.price - b.price || Number(a.tokenId) - Number(b.tokenId));

  const items: SweepPreviewItem[] = [];
  let total = 0;
  for (const listing of sorted) {
    if (quantity !== null && items.length >= quantity) break;
    if (maxSpend !== null && total + listing.price > maxSpend) break;
    if (quantity === null && maxSpend === null && items.length >= 5) break;
    if (items.length >= SWEEP_CART_CAP) break;
    items.push({
      tokenId: listing.tokenId,
      price: listing.price,
      currency: listing.currency,
      orderHash: listing.orderHash,
    });
    total += listing.price;
  }
  return {
    strategy: 'floor',
    items,
    count: items.length,
    total,
    currency: items[0]?.currency ?? 'USDG',
    truncated: sorted.length > items.length,
  };
}
