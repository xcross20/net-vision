import { describe, expect, it } from 'vitest';
import {
  classifyNumber,
  CURRENT_TAXONOMY_VERSION,
  VIRTUAL_COLLECTION_CATALOG,
  getVirtualCollection,
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
