import { describe, expect, it } from 'vitest';
import { BRAND_MEDIA, SHOWROOM_MEDIA, isShowroomPath } from './media';

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
});
