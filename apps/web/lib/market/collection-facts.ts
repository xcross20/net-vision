/**
 * Collection-level market facts from the worker index + official supply.
 * OpenSea collection stats never author the item count or listed count.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { coveragePercent, marketStatus } from './listing-state';
import { guardCollectionSnapshot } from './impossible-states';
import type { TokenCatalog } from './catalog';
import type { CollectionSnapshot } from './types';
import { DEFAULT_PAYMENT_CURRENCY } from './types';

export type CollectionIndexFacts = {
  totalSupply: number;
  listedCount: number;
  staleListedCount: number;
  verifiedCount: number;
  floorPrice: number | null;
  listingCoverage: number;
  marketStatus: 'syncing' | 'live';
};

export function collectionFacts(catalog: TokenCatalog): CollectionIndexFacts {
  const totalSupply = BUTTON_PRESSER_COLLECTION.officialExistingSupply;
  const listedCount = catalog.listedCount;
  const staleListedCount = catalog.staleListedCount;
  const verifiedCount = catalog.verifiedCount;
  const listingCoverage = coveragePercent(verifiedCount, totalSupply);
  return {
    totalSupply,
    listedCount,
    staleListedCount,
    verifiedCount,
    floorPrice: catalog.collectionFloorPrice(),
    listingCoverage,
    marketStatus: marketStatus(listingCoverage),
  };
}

export function baseCollectionSnapshot(
  extras: Partial<CollectionSnapshot> = {},
): CollectionSnapshot {
  const { totalSupply: _ignoredSupply, ...rest } = extras;
  const built: CollectionSnapshot = {
    name: BUTTON_PRESSER_COLLECTION.name,
    slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
    contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
    chainId: ROBINHOOD_CHAIN.id,
    openseaChainSlug: '',
    owners: null,
    listedCount: 0,
    staleListedCount: 0,
    listingCoverage: 0,
    marketStatus: 'syncing',
    snapshotRevision: 0,
    currency: DEFAULT_PAYMENT_CURRENCY,
    floorPrice: null,
    volume24hNative: null,
    volume7dNative: null,
    sales24h: null,
    sales7d: null,
    topSalePrice: null,
    topOfferPrice: null,
    refreshedAt: 0,
    ...rest,
    totalSupply: BUTTON_PRESSER_COLLECTION.officialExistingSupply,
  };
  return guardCollectionSnapshot(built);
}
