/**
 * Market data shapes exposed to the web app.
 *
 * These types are the production contract for the data layer. Routes and
 * UI components read from this shape and never from seed fixtures. Seed
 * data still exists, but only as a test-time fixture for offline UI
 * iteration and adversarial unit tests; it is no longer the runtime
 * source of truth.
 *
 * The market source abstraction lets us swap an in-memory implementation
 * (default for now) for a Postgres/Redis-backed implementation later
 * without touching routes or components.
 */

import type { NumberTrait } from '@net-vision/taxonomy';

export type TraitSlug = string;

export type Token = {
  tokenId: string;
  contractAddress: string;
  chainId: number;
  /** Live OpenSea image URL when available; falls back to the deterministic media proxy. */
  imageUrl: string;
  name: string | null;
  /** ETH-denominated listing price as a decimal string. null = no active ask. */
  listingPriceEth: string | null;
  /** Last sale price in ETH. null = no recorded sale. */
  lastSalePriceEth: string | null;
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
  floorPriceEth: number | null;
  lastSalePriceEth: number | null;
  topOfferPriceEth: number | null;
  topSalePriceEth: number | null;
  volume24hEth: number;
  volume7dEth: number;
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
  floorPriceEth: number | null;
  volume24hEth: number;
  volume7dEth: number;
  sales24h: number;
  sales7d: number;
  topSalePriceEth: number | null;
  topOfferPriceEth: number | null;
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
