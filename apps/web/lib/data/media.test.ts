import { describe, expect, it } from 'vitest';
import {
  buildTokenImageUrl,
  canonicalTokenImageUrl,
  isDerivedPosterUrl,
  isProxyImageUrl,
  resolveTokenImageUrl,
} from './media';

describe('resolveTokenImageUrl', () => {
  it('uses the canonical cache path as identity when nothing is stored', () => {
    expect(resolveTokenImageUrl('25941', null)).toBe('/api/media/canonical/25941');
    expect(resolveTokenImageUrl('25941', undefined)).toBe(canonicalTokenImageUrl('25941'));
  });

  it('keeps a stored canonical path and a remote https image', () => {
    expect(resolveTokenImageUrl('1', '/api/media/canonical/1')).toBe('/api/media/canonical/1');
    expect(resolveTokenImageUrl('1', 'https://raw2.seadn.io/robinhood/1.svg')).toBe(
      'https://raw2.seadn.io/robinhood/1.svg',
    );
  });

  it('does not use the derived-trait poster as identity', () => {
    expect(resolveTokenImageUrl('25941', buildTokenImageUrl('25941'))).toBe(
      '/api/media/canonical/25941',
    );
    expect(resolveTokenImageUrl('25941', '/api/media/token/25941')).not.toContain(
      '/api/media/token/',
    );
  });

  it('treats both local media routes as same-origin SVGs', () => {
    expect(isProxyImageUrl('/api/media/canonical/25941')).toBe(true);
    expect(isProxyImageUrl('/api/media/token/25941')).toBe(true);
    expect(isProxyImageUrl('https://raw2.seadn.io/robinhood/1.svg')).toBe(false);
  });

  it('does not treat canonical Plate art as a derived poster', () => {
    expect(isDerivedPosterUrl('/api/media/canonical/25941')).toBe(false);
    expect(isDerivedPosterUrl('/api/media/token/25941')).toBe(true);
    expect(isDerivedPosterUrl(null)).toBe(true);
  });
});
