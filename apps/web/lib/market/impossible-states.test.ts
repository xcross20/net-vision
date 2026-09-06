import { describe, expect, it } from 'vitest';
import { LIVE_COVERAGE_THRESHOLD } from './listing-state';
import {
  collectImpossibleMarketStates,
  guardCollectionSnapshot,
} from './impossible-states';
import { baseCollectionSnapshot } from './collection-facts';

describe('impossible market states', () => {
  it('rejects Items=0 with listed or owners as facts', () => {
    expect(
      collectImpossibleMarketStates({
        totalSupply: 0,
        listedCount: 3296,
        owners: 6400,
        marketStatus: 'syncing',
        listingCoverage: 0.4,
      }),
    ).toEqual(
      expect.arrayContaining([
        'zero-collection-supply',
        'zero-supply-with-listings',
        'zero-supply-with-owners',
      ]),
    );
  });

  it('rejects LIVE below coverage threshold', () => {
    expect(
      collectImpossibleMarketStates({
        totalSupply: 62093,
        listedCount: 100,
        owners: null,
        marketStatus: 'live',
        listingCoverage: 0.41,
        uiLive: true,
      }),
    ).toContain('live-below-coverage');
  });

  it('rejects UI Live while the read model is syncing', () => {
    expect(
      collectImpossibleMarketStates({
        totalSupply: 62093,
        listedCount: 100,
        owners: null,
        marketStatus: 'syncing',
        listingCoverage: 0.41,
        uiLive: true,
      }),
    ).toContain('ui-live-while-syncing');
  });

  it('guard never emits zero supply or live-below-coverage', () => {
    const guarded = guardCollectionSnapshot(
      baseCollectionSnapshot({
        totalSupply: 0,
        listedCount: 3296,
        owners: 6400,
        marketStatus: 'live',
        listingCoverage: 0.41,
      }),
    );
    expect(guarded.totalSupply).toBe(62093);
    expect(guarded.marketStatus).toBe('syncing');
    expect(guarded.listingCoverage).toBeLessThan(LIVE_COVERAGE_THRESHOLD);
    expect(
      collectImpossibleMarketStates({
        ...guarded,
        uiLive: false,
      }),
    ).toEqual([]);
  });
});
