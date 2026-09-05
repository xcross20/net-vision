/**
 * MarketSource interface: the seam between routes and the underlying
 * data layer.
 *
 * Every read path in the application routes through a MarketSource. The
 * default implementation is an in-memory OpenSea-backed source that
 * fetches and caches on demand; a future Postgres/Redis implementation
 * can drop in without changing consumers.
 *
 * All methods return promises so a Postgres/Redis implementation is a
 * drop-in.
 */

import type { SweepPreview, SweepPreviewInput, FloorSnapshot } from './engine';
import type {
  CategoryMetrics,
  CollectionSnapshot,
  DataFreshness,
  Token,
} from './types';

export type TokenListingStatus = 'listed' | 'not-listed';

export type ListTokensFilter = {
  category?: string;
  /**
   * Sub-filter facet values to apply. Format: `${slug}:${value}`. For
   * palindrome: `palindrome:digits-3`, `palindrome:digits-4`, etc.
   */
  facets?: string[];
  /** Listing status shown in the category UI. */
  status?: TokenListingStatus;
  /** When set, only include tokens currently listed. */
  listedOnly?: boolean;
  /** Number of results to return; sources may cap this. */
  limit?: number;
  /** Number of matching results to skip. */
  offset?: number;
};

export type ListTokensPage = {
  tokens: Token[];
  total: number;
};

export type Sale = {
  tokenId: string;
  price: number;
  currency: string;
  /** epoch seconds. */
  occurredAt: number;
  /** OpenSea order hash for the sale, when available. */
  orderHash: string | null;
  buyer: string | null;
  seller: string | null;
};

export type Offer = {
  tokenId: string;
  price: number;
  currency: string;
  /** epoch seconds; null when the offer has no expiry. */
  expiresAt: number | null;
  orderHash: string;
  maker: string;
};

export interface MarketSource {
  /** Snapshot of the whole Button Presser collection. */
  getCollectionSnapshot(): Promise<CollectionSnapshot>;
  /** Single token by id. null when the indexer has no record of it. */
  getToken(tokenId: string): Promise<Token | null>;
  /** List tokens, optionally filtered by category. */
  listTokens(filter?: ListTokensFilter): Promise<ListTokensPage>;
  /** Compute metrics for one category slug from the cached token set. */
  getCategoryMetrics(slug: string): Promise<CategoryMetrics | null>;
  /** All categories. */
  listCategories(): Promise<CategoryMetrics[]>;
  /** Recent sales for the collection, newest first. */
  listRecentSales(limit?: number): Promise<Sale[]>;
  /** Cleared sales for one token, newest first. */
  listTokenSales(tokenId: string, limit?: number): Promise<Sale[]>;
  /** Recent offers for the collection, highest first. */
  listRecentOffers(limit?: number): Promise<Offer[]>;
  /** Active offers on a single token, highest first. */
  getTokenOffers(tokenId: string): Promise<Offer[]>;
  /** Active listings owned by a wallet. */
  getAccountListings(address: string): Promise<Token[]>;
  /** Offers made by a wallet. */
  getAccountOffers(address: string): Promise<Offer[]>;
  /** Owned NFTs for a wallet, listed and unlisted. */
  listAccountTokens(address: string): Promise<Token[]>;
  /** Sales attributed to a category, newest first. */
  listCategorySales(slug: string, options?: { window?: SalesWindow; limit?: number }): Promise<Sale[]>;
  /** Highest attributed sales for a category. */
  listCategoryTopSales(slug: string, limit?: number): Promise<Sale[]>;
  /** Item offers on currently listed members of a category. */
  listCategoryOffers(slug: string, limit?: number): Promise<Offer[]>;
  previewSweep(slug: string, input: SweepPreviewInput): Promise<SweepPreview>;
  floorHistory(slug: string): Promise<FloorSnapshot[]>;
  /** Data freshness for the source. Used by the health endpoint and UI badges. */
  getFreshness(): Promise<DataFreshness>;
}

export type SalesWindow = '24h' | '7d' | '30d' | 'all';
