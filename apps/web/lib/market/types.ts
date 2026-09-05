/**
 * Market data shapes exposed to the web app.
 *
 * These types are the production contract for the data layer. Routes and
 * UI components read from this shape and never from seed fixtures. Seed
 * data still exists, but only as a test-time fixture for offline UI
 * iteration and adversarial unit tests; it is no longer the runtime
 * source of truth.
 */

import type { NumberTrait } from '@net-vision/taxonomy';

export const DEFAULT_PAYMENT_CURRENCY = 'USDG' as const;

export type TraitSlug = string;

export type Token = {
  tokenId: string;
  contractAddress: string;
  chainId: number;
  /** Live OpenSea image URL when available; falls back to the deterministic media proxy. */
  imageUrl: string;
  name: string | null;
  /** Payment-token price. null = no active ask. */
  listingPrice: number | null;
  currency: string;
  /** Most recent recorded payment-token sale. null = no recorded sale. */
  lastSalePrice: number | null;
  ownerAddress: string | null;
  traits: NumberTrait[];
  /** OpenSea rarity rank. null = not yet ranked. */
  rarityRank: number | null;
  /** When the most recent listing became active. epoch seconds. null = no listing. */
  listedAt: number | null;
  /** When the most recent sale happened. epoch seconds. null = no sale. */
  lastSaleAt: number | null;
};

export type CategoryMetrics = {
  slug: string;
  name: string;
  family: string;
  description: string;
  memberSupply: number;
  totalSupply: number;
  listedCount: number;
  owners: number;
  currency: string;
  floorPrice: number | null;
  lastSalePrice: number | null;
  topOfferPrice: number | null;
  topSalePrice: number | null;
  /** Native-chain volume, denominated in ETH on Robinhood Chain. */
  volume24hNative: number;
  volume7dNative: number;
  sales24h: number;
  sales7d: number;
};

export type CollectionSnapshot = {
  name: string;
  slug: string;
  contractAddress: string;
  chainId: number;
  openseaChainSlug: string;
  totalSupply: number;
  owners: number;
  listedCount: number;
  currency: string;
  floorPrice: number | null;
  /** Native-chain volume, denominated in ETH on Robinhood Chain. */
  volume24hNative: number;
  volume7dNative: number;
  sales24h: number;
  sales7d: number;
  topSalePrice: number | null;
  topOfferPrice: number | null;
  /** epoch milliseconds when the snapshot was produced. */
  refreshedAt: number;
};

export type DataFreshness = {
  /** True if the source produced at least one snapshot within the freshness window. */
  fresh: boolean;
  refreshedAt: number | null;
  source: 'opensea' | 'fixture' | 'cache';
  /** Resolved OpenSea chain slug from /api/v2/chains. null if discovery failed. */
  resolvedChainSlug: string | null;
};
