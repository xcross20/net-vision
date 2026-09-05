import { describe, expect, it } from 'vitest';
import {
  classifyDerivedFacets,
  classifyNumber,
  extractMetadataFacets,
  facetsForToken,
  getCuratedFacets,
  MATERIAL_PLATE_CATALOG,
  OFFICIAL_PLATE_SUPPLY,
  qaPlateRangeHint,
  VIRTUAL_COLLECTION_CATALOG,
} from '../src/index';

describe('official Plate metadata', () => {
  it('sums to the published collection supply', () => {
    expect(OFFICIAL_PLATE_SUPPLY).toBe(62093);
    expect(MATERIAL_PLATE_CATALOG.map((row) => row.officialCount)).toEqual([
      999, 4000, 15000, 42094,
    ]);
  });

  it('extracts Brass from Plate metadata and never from token id', () => {
    const brass = extractMetadataFacets('777', {
      traits: [{ trait_type: 'Plate', value: 'Brass' }],
    });
    expect(brass).toEqual([
      expect.objectContaining({
        tokenId: '777',
        family: 'material',
        slug: 'material-brass',
        label: 'Brass',
        source: 'metadata',
      }),
    ]);
    expect(extractMetadataFacets('777', { traits: [] })).toEqual([]);
    expect(extractMetadataFacets('1', null)).toEqual([]);
  });

  it('normalizes anodised / anodized aluminium spelling', () => {
    const facet = extractMetadataFacets('5000', {
      traits: [{ trait_type: 'plate', value: 'Anodized aluminum' }],
    });
    expect(facet[0]?.slug).toBe('material-anodised-aluminium');
    expect(facet[0]?.metadata?.originalLabel).toBe('Anodized aluminum');
  });

  it('does not treat tokenId 1 as Brass without metadata', () => {
    const facets = facetsForToken('1');
    expect(facets.some((f) => f.family === 'material')).toBe(false);
    expect(qaPlateRangeHint('1')).toBe('material-brass');
  });
});

describe('source separation', () => {
  it('keeps Plate out of classifyNumber', () => {
    const slugs = classifyNumber('777').traits.map((t) => t.slug);
    expect(slugs.some((slug) => slug.startsWith('material-'))).toBe(false);
    expect(slugs).toEqual(expect.arrayContaining(['digits-3', 'palindrome', 'repdigit', 'triple']));
    expect(slugs).not.toContain('lucky');
  });

  it('tags derived, curated, and metadata independently for #777', () => {
    const facets = facetsForToken('777', {
      traits: [{ trait_type: 'Plate', value: 'Brass' }],
    });
    const bySlug = Object.fromEntries(facets.map((f) => [f.slug, f]));
    expect(bySlug['digits-3']?.source).toBe('derived');
    expect(bySlug['digits-3']?.family).toBe('number');
    expect(bySlug.palindrome?.source).toBe('derived');
    expect(bySlug.palindrome?.family).toBe('pattern');
    expect(bySlug.repdigit?.source).toBe('derived');
    expect(bySlug.triple?.source).toBe('derived');
    expect(bySlug['material-brass']?.source).toBe('metadata');
    expect(bySlug['material-brass']?.family).toBe('material');
    expect(classifyDerivedFacets('777').some((f) => f.family === 'material')).toBe(false);
    expect(getCuratedFacets('69').map((f) => f.slug)).toContain('meme');
    expect(getCuratedFacets('69')[0]?.source).toBe('curated');
  });

  it('does not imply Brass from 3 Digit membership', () => {
    const three = facetsForToken('321');
    expect(three.some((f) => f.slug === 'digits-3')).toBe(true);
    expect(three.some((f) => f.slug === 'material-brass')).toBe(false);
  });
});

describe('category catalog families', () => {
  it('groups shipped categories into number/material/pattern/culture', () => {
    const byFamily = Object.fromEntries(
      VIRTUAL_COLLECTION_CATALOG.map((c) => [c.slug, c.family]),
    );
    expect(byFamily['digits-3']).toBe('number');
    expect(byFamily['material-brass']).toBe('material');
    expect(byFamily.palindrome).toBe('pattern');
    expect(byFamily.lucky).toBe('culture');
  });

  it('marks Plate categories as metadata-sourced', () => {
    const brass = VIRTUAL_COLLECTION_CATALOG.find((c) => c.slug === 'material-brass');
    expect(brass?.source).toBe('metadata');
    expect(brass?.expectedSupply).toBe(999);
  });
});
