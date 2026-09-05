/**
 * Token catalog: classify every Button Presser id, then layer live
 * listing and sale state on top.
 *
 * Pipeline stages (applied in order by the market source):
 *   1. classify  — deterministic category tags per token id
 *   2. ingest    — upsert unique listings (lowest ask wins)
 *   3. confirm   — per-token best-listing scan; 404 deletes the ask
 *   4. sales     — attach cleared trades
 *   5. metrics   — floor / ceiling / listed count per category
 *
 * The catalog never invents a listing. Unknown tokens stay unknown
 * until a scan or orderbook ingest says otherwise.
 */

import {
  classifyNumber,
  VIRTUAL_COLLECTION_CATALOG,
  type NumberTrait,
} from '@net-vision/taxonomy';

export type SupplyRange = { minTokenId: number; maxTokenId: number };

export type CatalogListing = {
  tokenId: string;
  price: number;
  currency: string;
  listedAt: number | null;
  ownerAddress: string | null;
  orderHash: string | null;
};

export type CatalogSale = {
  tokenId: string;
  price: number;
  currency: string;
  occurredAt: number;
  orderHash: string | null;
  buyer: string | null;
  seller: string | null;
};

export type CategoryTotals = {
  slug: string;
  memberSupply: number;
  listedCount: number;
  floorPrice: number | null;
  ceilingPrice: number | null;
  owners: number;
  lastSalePrice: number | null;
};

function parsePalindromeFacetValue(value: string): 2 | 3 | 4 | 5 | null {
  const match = /^digits-([2-5])$/.exec(value);
  if (!match) return null;
  return Number(match[1]) as 2 | 3 | 4 | 5;
}

export function isInSupplyRange(tokenId: string, range: SupplyRange): boolean {
  if (!/^\d+$/.test(tokenId)) return false;
  const numeric = Number(tokenId);
  return Number.isInteger(numeric) && numeric >= range.minTokenId && numeric <= range.maxTokenId;
}

/**
 * Keep one listing per token id. When the same id appears more than
 * once (broken orderbook cursors, multiple asks), the lowest priced
 * ask wins so category floors stay honest.
 */
export function dedupeListingsByLowestAsk(listings: CatalogListing[]): CatalogListing[] {
  const byToken = new Map<string, CatalogListing>();
  for (const listing of listings) {
    if (!listing.tokenId || !Number.isFinite(listing.price)) continue;
    const existing = byToken.get(listing.tokenId);
    if (!existing || listing.price < existing.price) {
      byToken.set(listing.tokenId, listing);
    }
  }
  return [...byToken.values()];
}

export class TokenCatalog {
  private readonly range: SupplyRange;
  private classified = false;
  private readonly slugsByToken = new Map<string, string[]>();
  private readonly tokensBySlug = new Map<string, string[]>();
  private readonly traitsByToken = new Map<string, NumberTrait[]>();
  private readonly listings = new Map<string, CatalogListing>();
  private readonly unlisted = new Set<string>();
  private readonly scanned = new Set<string>();
  private readonly salesByToken = new Map<string, CatalogSale[]>();
  private readonly allSales: CatalogSale[] = [];

  constructor(range: SupplyRange) {
    this.range = range;
  }

  get supplyRange(): SupplyRange {
    return this.range;
  }

  get isClassified(): boolean {
    return this.classified;
  }

  get scannedCount(): number {
    return this.scanned.size;
  }

  get listedCount(): number {
    return this.listings.size;
  }

  classify(): void {
    if (this.classified) return;
    for (let n = this.range.minTokenId; n <= this.range.maxTokenId; n += 1) {
      const tokenId = String(n);
      const classification = classifyNumber(tokenId);
      const slugs = classification.traits.map((trait) => trait.slug);
      this.traitsByToken.set(tokenId, classification.traits);
      this.slugsByToken.set(tokenId, slugs);
      for (const slug of slugs) {
        const members = this.tokensBySlug.get(slug) ?? [];
        members.push(tokenId);
        this.tokensBySlug.set(slug, members);
      }
    }
    this.classified = true;
  }

  traitsFor(tokenId: string): NumberTrait[] {
    this.classify();
    return this.traitsByToken.get(tokenId) ?? classifyNumber(tokenId).traits;
  }

  slugsFor(tokenId: string): string[] {
    this.classify();
    return this.slugsByToken.get(tokenId) ?? [];
  }

  memberIds(slug: string, facets?: string[]): string[] {
    this.classify();
    const members = this.tokensBySlug.get(slug) ?? [];
    if (!facets || facets.length === 0 || slug !== 'palindrome') return members;
    const wanted = new Set(
      facets
        .map(parsePalindromeFacetValue)
        .filter((digits): digits is 2 | 3 | 4 | 5 => digits !== null),
    );
    if (wanted.size === 0) return members;
    return members.filter((tokenId) => wanted.has(tokenId.length as 2 | 3 | 4 | 5));
  }

  /**
   * Stage 2: ingest unique listings. Invalid ids are dropped. Existing
   * cheaper asks are kept. A live ask clears any prior unlisted mark.
   */
  ingestListings(listings: CatalogListing[]): CatalogListing[] {
    this.classify();
    const unique = dedupeListingsByLowestAsk(listings).filter((listing) =>
      isInSupplyRange(listing.tokenId, this.range),
    );
    for (const listing of unique) {
      const existing = this.listings.get(listing.tokenId);
      if (existing && existing.price <= listing.price && existing.orderHash === listing.orderHash) {
        continue;
      }
      if (existing && existing.price < listing.price) continue;
      this.listings.set(listing.tokenId, listing);
      this.unlisted.delete(listing.tokenId);
      this.scanned.add(listing.tokenId);
    }
    return unique;
  }

  /**
   * Stage 3: a confirmed best-listing lookup. `null` means the token
   * has no active ask, so any catalog listing is deleted.
   */
  confirmScan(tokenId: string, listing: CatalogListing | null): void {
    if (!isInSupplyRange(tokenId, this.range)) return;
    this.scanned.add(tokenId);
    if (!listing) {
      this.listings.delete(tokenId);
      this.unlisted.add(tokenId);
      return;
    }
    this.ingestListings([listing]);
  }

  ingestSales(sales: CatalogSale[]): void {
    for (const sale of sales) {
      if (!isInSupplyRange(sale.tokenId, this.range)) continue;
      if (!Number.isFinite(sale.price) || sale.price < 0) continue;
      this.allSales.push(sale);
      const existing = this.salesByToken.get(sale.tokenId) ?? [];
      existing.push(sale);
      existing.sort((a, b) => b.occurredAt - a.occurredAt);
      this.salesByToken.set(sale.tokenId, existing);
    }
    this.allSales.sort((a, b) => b.occurredAt - a.occurredAt);
  }

  listingFor(tokenId: string): CatalogListing | undefined {
    return this.listings.get(tokenId);
  }

  isListed(tokenId: string): boolean {
    return this.listings.has(tokenId);
  }

  isConfirmedUnlisted(tokenId: string): boolean {
    return this.unlisted.has(tokenId);
  }

  isScanned(tokenId: string): boolean {
    return this.scanned.has(tokenId);
  }

  listedIds(slug?: string, facets?: string[]): string[] {
    if (!slug) return [...this.listings.keys()].sort((a, b) => Number(a) - Number(b));
    return this.memberIds(slug, facets).filter((tokenId) => this.listings.has(tokenId));
  }

  /**
   * Members with no known ask. Confirmed unlisted ids stay; ids that
   * still have an active catalog listing are excluded.
   */
  notListedIds(slug: string, facets?: string[]): string[] {
    return this.memberIds(slug, facets).filter((tokenId) => !this.listings.has(tokenId));
  }

  unscannedIds(slug: string, facets?: string[]): string[] {
    return this.memberIds(slug, facets).filter((tokenId) => !this.scanned.has(tokenId));
  }

  recentSales(limit: number): CatalogSale[] {
    return this.allSales.slice(0, Math.max(limit, 0));
  }

  salesFor(tokenId: string, limit = 20): CatalogSale[] {
    return (this.salesByToken.get(tokenId) ?? []).slice(0, limit);
  }

  lastSaleFor(tokenId: string): CatalogSale | undefined {
    return this.salesByToken.get(tokenId)?.[0];
  }

  categoryTotals(slug: string, facets?: string[]): CategoryTotals {
    const members = this.memberIds(slug, facets);
    const listed = members
      .map((tokenId) => this.listings.get(tokenId))
      .filter((listing): listing is CatalogListing => listing !== undefined);
    const prices = listed.map((listing) => listing.price);
    const owners = new Set(
      listed
        .map((listing) => listing.ownerAddress?.toLowerCase() ?? '')
        .filter(Boolean),
    );
    const memberSales = members
      .flatMap((tokenId) => this.salesByToken.get(tokenId) ?? [])
      .sort((a, b) => b.occurredAt - a.occurredAt);
    return {
      slug,
      memberSupply: members.length,
      listedCount: listed.length,
      floorPrice: prices.length > 0 ? Math.min(...prices) : null,
      ceilingPrice: prices.length > 0 ? Math.max(...prices) : null,
      owners: owners.size,
      lastSalePrice: memberSales[0]?.price ?? null,
    };
  }

  allCategoryTotals(): CategoryTotals[] {
    this.classify();
    return VIRTUAL_COLLECTION_CATALOG.map((entry) => this.categoryTotals(entry.slug));
  }
}
