/**
 * Token identity media.
 *
 * Canonical on-chain SVG lives at `/api/media/canonical/:id`.
 * `/api/media/token/:id` is a derived-trait poster — never identity art.
 */
import { canonicalMediaPath } from '@/lib/index/canonical-metadata';

/** @deprecated Derived-trait poster. Do not use as token identity. */
export function buildTokenImageUrl(tokenId: string): string {
  return `/api/media/token/${encodeURIComponent(tokenId)}`;
}

export function canonicalTokenImageUrl(tokenId: string): string {
  return canonicalMediaPath(tokenId);
}

/** True when Next should skip optimizer (same-origin SVG). */
export function isProxyImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.startsWith('/api/media/');
}

/** Derived-trait poster, not official Plate art. */
export function isDerivedPosterUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.startsWith('/api/media/token/');
}

/**
 * Prefer cached official Plate art, then a remote https image, then the
 * canonical media route (honest pending SVG if the cache is empty).
 * Never return the derived-trait poster as identity.
 */
export function resolveTokenImageUrl(
  tokenId: string,
  storedImageUrl: string | null | undefined,
): string {
  if (storedImageUrl) {
    if (storedImageUrl.startsWith('/api/media/canonical/')) return storedImageUrl;
    if (/^https?:\/\//i.test(storedImageUrl)) return storedImageUrl;
    if (!isDerivedPosterUrl(storedImageUrl) && storedImageUrl.startsWith('/')) {
      return storedImageUrl;
    }
  }
  return canonicalTokenImageUrl(tokenId);
}
