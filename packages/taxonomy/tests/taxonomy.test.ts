import { describe, expect, it } from 'vitest';
import {
  classifyNumber,
  CURRENT_TAXONOMY_VERSION,
  VIRTUAL_COLLECTION_CATALOG,
  getVirtualCollection,
  enumerateMembers,
  isMember,
} from '../src/index';

describe('classifyNumber', () => {
  const fixtures: Array<[string, string[]]> = [
    ['7', ['digits-1']],
    ['11', ['digits-2', 'palindrome', 'repdigit', 'double']],
    ['121', ['digits-3', 'palindrome', 'bookend']],
    ['7777', ['digits-4', 'palindrome', 'repdigit', 'double', 'triple', 'quad']],
    ['12345', ['digits-5', 'ascending']],
    ['54321', ['digits-5', 'descending']],
    ['12321', ['digits-5', 'palindrome', 'bookend', 'mirror-sequence']],
    ['6969', ['digits-4', 'alternating', 'meme']],
    ['10001', ['digits-5', 'palindrome', 'bookend', 'binary-style']],
    ['1337', ['digits-4', 'meme']],
  ];

  it.each(fixtures)('classifies %s as %s', (input, expected) => {
    const result = classifyNumber(input);
    const slugs = result.traits.map((t) => t.slug);
    for (const exp of expected) {
      expect(slugs, `expected ${input} to include ${exp}`).toContain(exp);
    }
    expect(result.taxonomyVersion).toBe(CURRENT_TAXONOMY_VERSION);
    expect(result.canonical).toBe(input);
  });

  it('is deterministic for the same input and version', () => {
    const a = classifyNumber('12345');
    const b = classifyNumber('12345');
    expect(a).toEqual(b);
  });

  it('treats leading-zero inputs as canonicalized', () => {
    const a = classifyNumber('00007');
    expect(a.canonical).toBe('7');
  });

  it('keeps the Presser value aligned with token 628', () => {
    const result = classifyNumber('628');
    expect(result.canonical).toBe('628');
    expect(result.digitCount).toBe(3);
    expect(result.traits).toContainEqual(
      expect.objectContaining({
        slug: 'digits-3',
        family: 'digits',
        label: '3 Digit',
      }),
    );
  });

  it('rejects non-integer input', () => {
    expect(() => classifyNumber('1.5')).toThrow();
    expect(() => classifyNumber('abc')).toThrow();
    expect(() => classifyNumber('')).toThrow();
  });

  it('rejects zero', () => {
    expect(() => classifyNumber('0')).toThrow();
    expect(() => classifyNumber('0000')).toThrow();
  });

  it('rejects unsupported taxonomy version', () => {
    expect(() => classifyNumber('7', 999)).toThrow();
  });

  it('never returns duplicate trait slugs', () => {
    for (const input of ['7', '11', '121', '7777', '12345', '54321', '12321', '6969', '10001', '1337']) {
      const r = classifyNumber(input);
      const slugs = r.traits.map((t) => t.slug);
      expect(new Set(slugs).size, `duplicates for ${input}: ${slugs.join(',')}`).toBe(slugs.length);
    }
  });

  it('digitCount is always exactly one', () => {
    for (const input of ['1', '99', '100', '9999', '10000', '99999']) {
      const r = classifyNumber(input);
      const digitTraits = r.traits.filter((t) => t.family === 'digits');
      expect(digitTraits.length).toBe(1);
      expect(digitTraits[0]?.slug).toBe(`digits-${r.digitCount}`);
    }
  });

  it('palindrome invariant: s === reverse(s)', () => {
    for (const input of ['1', '11', '121', '12321', '1234321', '5']) {
      const r = classifyNumber(input);
      const slugs = r.traits.map((t) => t.slug);
      expect(slugs.includes('palindrome')).toBe(true);
    }
  });

  it('repdigit invariant: unique digit count equals 1', () => {
    for (const input of ['1', '22', '333', '4444', '55555']) {
      const r = classifyNumber(input);
      const slugs = r.traits.map((t) => t.slug);
      expect(slugs.includes('repdigit')).toBe(true);
    }
  });

  it('ascending sequence invariant', () => {
    expect(classifyNumber('1234').traits.map((t) => t.slug)).toContain('ascending');
    expect(classifyNumber('6789').traits.map((t) => t.slug)).toContain('ascending');
    expect(classifyNumber('1235').traits.map((t) => t.slug)).not.toContain('ascending');
  });

  it('descending sequence invariant', () => {
    expect(classifyNumber('4321').traits.map((t) => t.slug)).toContain('descending');
    expect(classifyNumber('9876').traits.map((t) => t.slug)).toContain('descending');
    expect(classifyNumber('4322').traits.map((t) => t.slug)).not.toContain('descending');
  });
});

describe('VIRTUAL_COLLECTION_CATALOG', () => {
  it('contains the spec baseline collections', () => {
    const slugs = VIRTUAL_COLLECTION_CATALOG.map((c) => c.slug);
    for (const required of [
      'digits-1',
      'digits-2',
      'digits-3',
      'digits-4',
      'digits-5',
      'palindrome',
      'repdigit',
      'double',
      'triple',
      'quad',
      'ascending',
      'descending',
      'alternating',
      'bookend',
      'round',
      'meme',
      'lucky',
      'year',
      'binary-style',
      'mirror-sequence',
      'material-brass',
      'material-steel',
      'material-anodised-aluminium',
      'material-printed-phenolic',
    ]) {
      expect(slugs).toContain(required);
    }
  });

  it('has unique slugs', () => {
    const slugs = VIRTUAL_COLLECTION_CATALOG.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getVirtualCollection finds known slugs', () => {
    expect(getVirtualCollection('palindrome')?.name).toBe('Palindromes');
    expect(getVirtualCollection('does-not-exist')).toBeNull();
  });
});

describe('enumerateMembers', () => {
  it('matches the published Button Presser supply range counts', () => {
    expect(enumerateMembers('digits-1').count).toBe(9);
    expect(enumerateMembers('digits-2').count).toBe(90);
    expect(enumerateMembers('digits-3').count).toBe(900);
    expect(enumerateMembers('digits-4').count).toBe(9000);
    expect(enumerateMembers('digits-5').count).toBe(52096);
    expect(enumerateMembers('palindrome').count).toBe(719);
    expect(enumerateMembers('repdigit').count).toBe(41);
    expect(enumerateMembers('mirror-sequence').count).toBe(597);
    expect(enumerateMembers('bookend').count).toBe(6176);
  });

  it('palindrome sub-divides into 2/3/4/5 digit buckets', () => {
    const set = enumerateMembers('palindrome');
    expect(set.byDigitCount).toBeDefined();
    expect(set.byDigitCount![2].length).toBe(9);
    expect(set.byDigitCount![3].length).toBe(90);
    expect(set.byDigitCount![4].length).toBe(90);
    expect(set.byDigitCount![5].length).toBe(521);
    // Sum of sub-buckets plus the 9 single-digit palindromes equals total.
    const sub =
      set.byDigitCount![2].length +
      set.byDigitCount![3].length +
      set.byDigitCount![4].length +
      set.byDigitCount![5].length;
    expect(sub + 9).toBe(set.count);
  });

  it('returns the same set every call', () => {
    const a = enumerateMembers('palindrome');
    const b = enumerateMembers('palindrome');
    expect(a).toEqual(b);
  });

  it('returns an empty set for unknown slugs', () => {
    expect(enumerateMembers('does-not-exist').count).toBe(0);
    expect(enumerateMembers('does-not-exist').members).toEqual([]);
  });

  it('first and last 3-digit palindrome are 101 and 999', () => {
    const set = enumerateMembers('palindrome');
    const three = set.members.filter((id) => id.length === 3);
    expect(three[0]).toBe('101');
    expect(three[three.length - 1]).toBe('999');
  });

  it('first and last 5-digit palindrome are 10001 and 62026', () => {
    const set = enumerateMembers('palindrome');
    const five = set.members.filter((id) => id.length === 5);
    expect(five[0]).toBe('10001');
    expect(five[five.length - 1]).toBe('62026');
  });

  it('respects a custom supply range', () => {
    const set = enumerateMembers('palindrome', { minTokenId: 1, maxTokenId: 1000 });
    // 9 single-digit (1..9) + 9 two-digit (11..99) + 90 three-digit (101..999) = 108.
    expect(set.count).toBe(108);
    expect(set.members.every((id) => Number(id) <= 1000)).toBe(true);
  });
});

describe('isMember', () => {
  it('returns true for known members', () => {
    expect(isMember('palindrome', '121')).toBe(true);
    expect(isMember('palindrome', '62026')).toBe(true);
    expect(isMember('digits-3', '101')).toBe(true);
    expect(isMember('mirror-sequence', '12321')).toBe(true);
    expect(isMember('bookend', '121')).toBe(true);
    expect(isMember('repdigit', '7777')).toBe(true);
  });

  it('returns false for non-members', () => {
    expect(isMember('palindrome', '123')).toBe(false);
    expect(isMember('palindrome', '10')).toBe(false);
    expect(isMember('digits-5', '9999')).toBe(false);
    expect(isMember('mirror-sequence', '11')).toBe(false);
    expect(isMember('bookend', '7777')).toBe(false);
  });
});
