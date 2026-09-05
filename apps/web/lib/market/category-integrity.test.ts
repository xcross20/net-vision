import { describe, expect, it } from 'vitest';
import { classifyNumber, enumerateMembers } from '@net-vision/taxonomy';
import { TokenCatalog } from './catalog';

const RANGE = { minTokenId: 1, maxTokenId: 999 };

describe('category integrity', () => {
  it('digits-3 membership is exactly 100 through 999', () => {
    const members = enumerateMembers('digits-3', RANGE);
    expect(members.count).toBe(900);
    expect(members.members[0]).toBe('100');
    expect(members.members[members.members.length - 1]).toBe('999');
    for (const id of ['99', '1000']) {
      expect(classifyNumber(id).traits.some((t) => t.slug === 'digits-3')).toBe(false);
    }
  });

  it('palindrome membership is structural, not market-derived', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.classify();
    expect(catalog.memberIds('palindrome')).toContain('121');
    expect(catalog.memberIds('palindrome')).toContain('7');
    expect(catalog.listedIds('palindrome')).toEqual([]);
    expect(catalog.unknownIds('palindrome').length).toBe(catalog.memberIds('palindrome').length);
  });

  it('repdigit 777 is repeating and 3-digit independently of listings', () => {
    const traits = classifyNumber('777').traits.map((t) => t.slug);
    expect(traits).toEqual(expect.arrayContaining(['digits-3', 'repdigit', 'palindrome', 'triple']));
  });

  it('category floor is the min verified ask and ignores unknown members', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.confirmScan('966', {
      tokenId: '966',
      price: 540,
      currency: 'USDG',
      listedAt: 1,
      ownerAddress: null,
      orderHash: '0x966',
    });
    catalog.confirmScan('121', {
      tokenId: '121',
      price: 12,
      currency: 'USDG',
      listedAt: 1,
      ownerAddress: null,
      orderHash: '0x121',
    });
    const totals = catalog.categoryTotals('digits-3');
    expect(totals.listedCount).toBe(2);
    expect(totals.floorPrice).toBe(12);
    expect(totals.verifiedCount).toBe(2);
    expect(totals.unknownCount).toBe(898);
    expect(totals.marketStatus).toBe('syncing');
    expect(totals.coveragePercent).toBeCloseTo(2 / 900, 6);
  });

  it('unknown versus verified-unlisted are disjoint', () => {
    const catalog = new TokenCatalog(RANGE);
    catalog.confirmScan('628', null);
    expect(catalog.unlistedVerifiedIds('digits-3')).toEqual(['628']);
    expect(catalog.unknownIds('digits-3')).not.toContain('628');
    expect(catalog.listedIds('digits-3')).not.toContain('628');
  });
});
