import { describe, expect, it } from 'vitest';
import {
  BRAND_MEDIA,
  FEATURED_CATEGORY_SLUGS,
  PLATE_MATERIAL_SLUGS,
  SHOWROOM_MEDIA,
  isPlateMaterialSlug,
  isShowroomPath,
  showroomHeroForCategory,
} from './media';

describe('brand media', () => {
  it('keeps showroom plates under /brand/showroom', () => {
    for (const src of Object.values(SHOWROOM_MEDIA)) {
      expect(src.startsWith('/brand/showroom/')).toBe(true);
      expect(src.endsWith('.jpg')).toBe(true);
    }
  });

  it('treats mockup screenshots and showroom plates as decorative, not token media', () => {
    expect(isShowroomPath(SHOWROOM_MEDIA.homepageHero)).toBe(true);
    expect(isShowroomPath(BRAND_MEDIA.references.homepage)).toBe(true);
    expect(isShowroomPath('/api/media/token/966')).toBe(false);
    expect(isShowroomPath('https://raw2.seadn.io/robinhood/example.svg')).toBe(false);
  });

  it('gives each official Plate material its own category-detail atmosphere', () => {
    const heroes = PLATE_MATERIAL_SLUGS.map((slug) => showroomHeroForCategory(slug));
    expect(new Set(heroes).size).toBe(PLATE_MATERIAL_SLUGS.length);
    expect(showroomHeroForCategory('material-brass')).toBe(SHOWROOM_MEDIA.categoryHero);
    expect(showroomHeroForCategory('material-steel')).toBe(SHOWROOM_MEDIA.categoryHeroSteel);
    expect(showroomHeroForCategory('material-anodised-aluminium')).toBe(
      SHOWROOM_MEDIA.categoryHeroAnodisedAluminium,
    );
    expect(showroomHeroForCategory('material-printed-phenolic')).toBe(
      SHOWROOM_MEDIA.categoryHeroPrintedPhenolic,
    );
    for (const src of heroes) {
      expect(isShowroomPath(src)).toBe(true);
    }
  });

  it('does not invent a material plate for unknown categories', () => {
    expect(isPlateMaterialSlug('digits-4')).toBe(false);
    expect(showroomHeroForCategory('digits-4')).toBe(SHOWROOM_MEDIA.categoryHero);
  });

  it('gives featured explorer categories dedicated atmosphere stills', () => {
    expect(FEATURED_CATEGORY_SLUGS).toContain('digits-3');
    expect(showroomHeroForCategory('digits-3')).toBe(SHOWROOM_MEDIA.categoryHeroDigits3);
    expect(showroomHeroForCategory('palindrome')).toBe(SHOWROOM_MEDIA.categoryHeroPalindrome);
    expect(showroomHeroForCategory('lucky')).toBe(SHOWROOM_MEDIA.categoryHeroLucky);
    expect(showroomHeroForCategory('meme')).toBe(SHOWROOM_MEDIA.categoryHeroMeme);
  });
});
