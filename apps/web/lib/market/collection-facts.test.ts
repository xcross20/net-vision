import { describe, expect, it } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { TokenCatalog } from './catalog';
import { baseCollectionSnapshot, collectionFacts } from './collection-facts';
import { applyObservation, emptyListingRecord } from './listing-state';

const RANGE = {
  minTokenId: BUTTON_PRESSER_COLLECTION.minTokenId,
  maxTokenId: BUTTON_PRESSER_COLLECTION.maxTokenId,
};

describe('collectionFacts', () => {
  it('uses officialExistingSupply, never OpenSea zero or discovery max', () => {
    const catalog = new TokenCatalog(RANGE);
    const facts = collectionFacts(catalog);
    expect(facts.totalSupply).toBe(62093);
    expect(facts.totalSupply).not.toBe(0);
    expect(facts.totalSupply).not.toBe(BUTTON_PRESSER_COLLECTION.maxTokenId);
    expect(facts.listedCount).toBe(0);
    expect(facts.marketStatus).toBe('syncing');
  });

  it('counts LISTED only and ignores STALE for listedCount and floor', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.ingestListings([
      {
        tokenId: '100',
        price: 50,
        currency: 'USDG',
        listedAt: 1,
        ownerAddress: null,
        orderHash: '0x1',
      },
      {
        tokenId: '200',
        price: 10,
        currency: 'USDG',
        listedAt: 1,
        ownerAddress: null,
        orderHash: '0x2',
      },
    ]);
    const stale = applyObservation(emptyListingRecord('300'), {
      kind: 'ask',
      price: 1,
      currency: 'USDG',
      orderHash: '0x3',
      seller: null,
      listedAt: 1,
    });
    catalog.hydrateListingRecord({ ...stale, state: 'STALE', lastVerifiedAt: 1 });
    const facts = collectionFacts(catalog);
    expect(facts.listedCount).toBe(2);
    expect(facts.staleListedCount).toBe(1);
    expect(facts.floorPrice).toBe(10);
    expect(facts.totalSupply).toBe(62093);
  });

  it('unavailable snapshot still carries official supply, not fabricated zeroes for items', () => {
    const snapshot = baseCollectionSnapshot();
    expect(snapshot.totalSupply).toBe(62093);
    expect(snapshot.owners).toBeNull();
    expect(snapshot.volume24hNative).toBeNull();
    expect(snapshot.sales24h).toBeNull();
    expect(snapshot.marketStatus).toBe('syncing');
  });
});
