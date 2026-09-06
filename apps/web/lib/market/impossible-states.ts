/**
 * Impossible-state assertions. These combinations cannot be shown as
 * authoritative market facts. Tests reject them; runtime guards coerce
 * LIVE/zero-supply rather than taking the page down.
 */
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { LIVE_COVERAGE_THRESHOLD } from './listing-state';
import type { CollectionSnapshot } from './types';

export function collectImpossibleMarketStates(input: {
  totalSupply: number;
  listedCount: number;
  owners: number | null;
  marketStatus: 'syncing' | 'live';
  listingCoverage: number;
  uiLive?: boolean;
}): string[] {
  const violations: string[] = [];
  if (input.totalSupply <= 0) violations.push('zero-collection-supply');
  if (input.totalSupply <= 0 && input.listedCount > 0) {
    violations.push('zero-supply-with-listings');
  }
  if (input.totalSupply <= 0 && input.owners != null && input.owners > 0) {
    violations.push('zero-supply-with-owners');
  }
  if (input.totalSupply > 0 && input.listedCount > input.totalSupply) {
    violations.push('listed-exceeds-supply');
  }
  if (input.marketStatus === 'live' && input.listingCoverage < LIVE_COVERAGE_THRESHOLD) {
    violations.push('live-below-coverage');
  }
  if (input.uiLive && input.marketStatus !== 'live') {
    violations.push('ui-live-while-syncing');
  }
  return violations;
}

export function guardCollectionSnapshot(snapshot: CollectionSnapshot): CollectionSnapshot {
  const totalSupply = BUTTON_PRESSER_COLLECTION.officialExistingSupply;
  const listingCoverage = snapshot.listingCoverage;
  const marketStatus =
    snapshot.marketStatus === 'live' && listingCoverage >= LIVE_COVERAGE_THRESHOLD
      ? 'live'
      : 'syncing';
  const listedCount = Math.min(Math.max(snapshot.listedCount, 0), totalSupply);
  return {
    ...snapshot,
    totalSupply,
    listedCount,
    marketStatus,
    listingCoverage,
  };
}
