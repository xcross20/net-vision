import { describe, expect, it } from 'vitest';
import { OpenSeaResponseError } from '@net-vision/opensea-client';
import { TokenCatalog, dedupeListingsByLowestAsk, isInSupplyRange } from './catalog';
import { isOpenSeaRateLimited } from './opensea-errors';

const RANGE = { minTokenId: 1, maxTokenId: 999 };

function listing(
  tokenId: string,
  price: number,
  extra: Partial<{ currency: string; listedAt: number | null; ownerAddress: string | null; orderHash: string | null }> = {},
) {
  return {
    tokenId,
    price,
    currency: extra.currency ?? 'USDG',
    listedAt: extra.listedAt ?? 1_700_000_000,
    ownerAddress: extra.ownerAddress ?? '0x0000000000000000000000000000000000000abc',
    orderHash: extra.orderHash ?? `0x${tokenId}`,
  };
}

describe('isOpenSeaRateLimited', () => {
  it('treats 429 as a cooldown, not a missing listing', () => {
    expect(isOpenSeaRateLimited(new OpenSeaResponseError('rate limited', 429))).toBe(true);
    expect(isOpenSeaRateLimited(new OpenSeaResponseError('not found', 404))).toBe(false);
    expect(isOpenSeaRateLimited(new Error('network down'))).toBe(false);
  });
});

describe('dedupeListingsByLowestAsk', () => {
  it('collapses repeated token ids to the cheapest ask', () => {
    const unique = dedupeListingsByLowestAsk([
      listing('35853', 0.85, { orderHash: '0xaaa' }),
      listing('35853', 0.85, { orderHash: '0xbbb' }),
      listing('35853', 0.4, { orderHash: '0xccc' }),
      listing('121', 12, { orderHash: '0xddd' }),
    ]);
    expect(unique).toHaveLength(2);
    expect(unique.find((row) => row.tokenId === '35853')?.price).toBe(0.4);
    expect(unique.find((row) => row.tokenId === '121')?.price).toBe(12);
  });
});

describe('isInSupplyRange', () => {
  it('rejects non-numeric and out-of-range ids', () => {
    expect(isInSupplyRange('628', RANGE)).toBe(true);
    expect(isInSupplyRange('0', RANGE)).toBe(false);
    expect(isInSupplyRange('1000', RANGE)).toBe(false);
    expect(isInSupplyRange('12a', RANGE)).toBe(false);
  });
});

describe('TokenCatalog material facets', () => {
  it('does not treat 777 as Brass until Plate metadata is attached', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.classify();
    expect(catalog.memberIds('material-brass')).not.toContain('777');
    catalog.attachFacets('777', [
      {
        tokenId: '777',
        family: 'material',
        slug: 'material-brass',
        label: 'Brass',
        source: 'metadata',
        sourceVersion: 'opensea-plate-v1',
      },
    ]);
    expect(catalog.memberIds('material-brass')).toContain('777');
    expect(catalog.memberIds('digits-3')).toContain('777');
  });
});

describe('TokenCatalog', () => {
  it('tags 628 as a 3-digit token and 121 as a palindrome', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.classify();
    expect(catalog.slugsFor('628')).toContain('digits-3');
    expect(catalog.slugsFor('121')).toContain('palindrome');
    expect(catalog.memberIds('digits-3')).toContain('628');
    expect(catalog.memberIds('palindrome')).toContain('121');
  });

  it('does not count duplicate palindrome listings twenty times', () => {
    const catalog = new TokenCatalog(RANGE);
    const copies = Array.from({ length: 20 }, (_, i) =>
      listing('121', 0.85, { orderHash: `0x${i}` }),
    );
    catalog.ingestListings(copies);
    const totals = catalog.categoryTotals('palindrome');
    expect(totals.listedCount).toBe(1);
    expect(totals.floorPrice).toBe(0.85);
    expect(totals.ceilingPrice).toBe(0.85);
    expect(catalog.listedIds('palindrome')).toEqual(['121']);
  });

  it('computes distinct floors per category from unique listings', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.ingestListings([
      listing('121', 12),
      listing('131', 40),
      listing('628', 560),
      listing('12', 7),
    ]);
    expect(catalog.categoryTotals('palindrome').floorPrice).toBe(12);
    expect(catalog.categoryTotals('palindrome').ceilingPrice).toBe(40);
    expect(catalog.categoryTotals('digits-3').floorPrice).toBe(12);
    expect(catalog.categoryTotals('digits-3').listedCount).toBe(3);
    expect(catalog.categoryTotals('digits-2').floorPrice).toBe(7);
    expect(catalog.categoryTotals('digits-1').listedCount).toBe(0);
    expect(catalog.categoryTotals('digits-1').floorPrice).toBeNull();
  });

  it('lists category ids cheapest-first so the grid matches the floor metric', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.ingestListings([
      listing('628', 560),
      listing('121', 12),
      listing('966', 650),
    ]);
    expect(catalog.listedIds('digits-3')).toEqual(['121', '628', '966']);
    expect(catalog.listedIds('digits-3').length).toBe(
      catalog.categoryTotals('digits-3').listedCount,
    );
  });

  it('keeps an unscanned token unknown, not unlisted', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.classify();
    expect(catalog.unknownIds('digits-3')).toContain('628');
    expect(catalog.unlistedVerifiedIds('digits-3')).not.toContain('628');
    expect(catalog.listingState('628')).toBe('UNKNOWN');
    catalog.confirmScan('628', listing('628', 560));
    expect(catalog.isListed('628')).toBe(true);
    expect(catalog.unknownIds('digits-3')).not.toContain('628');
    expect(catalog.listedIds('digits-3')).toContain('628');
  });

  it('keeps a listing stale through one no-ask, then unlists after repeated misses', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.ingestListings([listing('628', 560)]);
    catalog.confirmScan('628', null);
    expect(catalog.isListed('628')).toBe(false);
    expect(catalog.listingState('628')).toBe('STALE');
    catalog.confirmScan('628', null);
    catalog.confirmScan('628', null);
    expect(catalog.isConfirmedUnlisted('628')).toBe(true);
    expect(catalog.listingState('628')).toBe('UNLISTED_VERIFIED');
    expect(catalog.categoryTotals('digits-3').listedCount).toBe(0);
  });

  it('attaches sales without changing listing identity', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.ingestListings([listing('121', 12)]);
    catalog.ingestSales([
      {
        tokenId: '121',
        price: 10,
        currency: 'USDG',
        occurredAt: 1_800_000_000,
        orderHash: '0xsale',
        buyer: '0x0000000000000000000000000000000000000aaa',
        seller: '0x0000000000000000000000000000000000000bbb',
      },
    ]);
    expect(catalog.lastSaleFor('121')?.price).toBe(10);
    expect(catalog.listingFor('121')?.price).toBe(12);
    expect(catalog.recentSales(5)).toHaveLength(1);
  });

  it('does not treat empty Brass membership as fully covered', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.classify();
    // Material membership only via attachFacets — never enumerated.
    expect(catalog.memberIds('material-brass')).toEqual([]);
    const totals = catalog.categoryTotals('material-brass');
    expect(totals.memberSupply).toBe(0);
    expect(totals.coveragePercent).toBe(0);
    expect(totals.marketStatus).toBe('syncing');
  });
});

