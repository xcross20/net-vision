import { describe, expect, it } from 'vitest';
import { facetsForToken } from '@net-vision/taxonomy';
import {
  attributeSale,
  computeCategoryMarketStats,
  previewFloorSweep,
  trendingScore,
} from './engine';

const NOW = 1_800_000_000_000;

function sale(tokenId: string, price: number, occurredAt = Math.floor(NOW / 1000)) {
  return {
    tokenId,
    price,
    currency: 'USDG',
    occurredAt,
    orderHash: `0x${tokenId}`,
    buyer: null,
    seller: null,
  };
}

describe('sales attribution', () => {
  it('attributes #777 independently to every facet at sale time', () => {
    const facets = facetsForToken('777', {
      traits: [{ trait_type: 'Plate', value: 'Brass' }],
    });
    const rows = attributeSale(sale('777', 5000), facets);
    const slugs = rows.map((row) => row.categorySlug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        'digits-3',
        'material-brass',
        'palindrome',
        'repdigit',
        'triple',
      ]),
    );
    expect(rows.every((row) => row.attributedPrice === 5000)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('does not attribute Brass when Plate is unknown', () => {
    const rows = attributeSale(sale('777', 5000), facetsForToken('777'));
    expect(rows.some((row) => row.categorySlug === 'material-brass')).toBe(false);
    expect(rows.some((row) => row.categorySlug === 'digits-3')).toBe(true);
  });

  it('does not sum overlapping category volumes into one global figure', () => {
    const facets = facetsForToken('777', {
      traits: [{ trait_type: 'Plate', value: 'Brass' }],
    });
    const attributions = attributeSale(sale('777', 5000), facets);
    const stats3 = computeCategoryMarketStats({
      slug: 'digits-3',
      listings: [],
      attributions,
      sales: [sale('777', 5000)],
      offers: [],
      floorHistory: [],
      trackedSince: NOW,
      now: NOW,
    });
    const statsBrass = computeCategoryMarketStats({
      slug: 'material-brass',
      listings: [],
      attributions,
      sales: [sale('777', 5000)],
      offers: [],
      floorHistory: [],
      trackedSince: NOW,
      now: NOW,
    });
    expect(stats3.volumeAllTracked).toBe(5000);
    expect(statsBrass.volumeAllTracked).toBe(5000);
  });
});

describe('floor sweep preview', () => {
  const listings = [
    { tokenId: '756', price: 650, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'a' },
    { tokenId: '635', price: 666, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'b' },
    { tokenId: '587', price: 698, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'c' },
    { tokenId: '700', price: 700, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'd' },
    { tokenId: '569', price: 700, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'e' },
    { tokenId: '830', price: 900, currency: 'USDG', listedAt: 1, ownerAddress: null, orderHash: 'f' },
  ];

  it('takes cheapest N under a per-item cap', () => {
    const preview = previewFloorSweep(listings, { quantity: 5, maxPricePerItem: 1000 });
    expect(preview.items.map((i) => i.tokenId)).toEqual(['756', '635', '587', '569', '700']);
    expect(preview.total).toBe(3414);
  });

  it('stops at max spend', () => {
    const preview = previewFloorSweep(listings, { maxSpend: 1400 });
    expect(preview.items.map((i) => i.tokenId)).toEqual(['756', '635']);
    expect(preview.total).toBe(1316);
  });
});

describe('trending score', () => {
  it('does not call a category trending just because floor moved', () => {
    const floorOnly = trendingScore({
      volumeAcceleration: 0,
      salesAcceleration: 0,
      floorMovement: 0.2,
      offerGrowth: 0,
      listingVelocity: 0,
    });
    const real = trendingScore({
      volumeAcceleration: 1,
      salesAcceleration: 0.8,
      floorMovement: 0.2,
      offerGrowth: 0.4,
      listingVelocity: 0.2,
    });
    expect(floorOnly.score).toBeLessThan(20);
    expect(real.score).toBeGreaterThan(floorOnly.score);
  });
});
