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

import type {
  CategoryMetrics,
  CollectionSnapshot,
  DataFreshness,
  Token,
} from './types';

export type ListTokensFilter = {
  category?: string;
  /**
   * Sub-filter facet values to apply. Format: `${slug}:${value}`. For
   * palindrome: `palindrome:digits-3`, `palindrome:digits-4`, etc.
   */
  facets?: string[];
  /** When set, only include tokens currently listed. */
  listedOnly?: boolean;
  /** Page size; sources may cap this. */
  limit?: number;
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
  /** Recent offers for the collection, highest first. */
  listRecentOffers(limit?: number): Promise<Offer[]>;
  /** Active offers on a single token, highest first. */
  getTokenOffers(tokenId: string): Promise<Offer[]>;
  /** Active listings owned by a wallet. */
  getAccountListings(address: string): Promise<Token[]>;
  /** Offers made by a wallet. */
  getAccountOffers(address: string): Promise<Offer[]>;
  /** Data freshness for the source. Used by the health endpoint and UI badges. */
  getFreshness(): Promise<DataFreshness>;
}
