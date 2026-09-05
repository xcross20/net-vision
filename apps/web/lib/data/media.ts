/**
 * Deterministic media URL helper.
 *
 * When the live OpenSea metadata endpoint returns no image we fall back
 * to the in-app deterministic SVG. This keeps the UI populated when
 * OpenSea has not yet indexed a token, while still surfacing the real
 * image whenever it is available.
 */

export function buildTokenImageUrl(tokenId: string): string {
  return `/api/media/token/${encodeURIComponent(tokenId)}`;
}

/** True when the URL is our local SVG placeholder, not OpenSea art. */
export function isProxyImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.startsWith('/api/media/token/');
}

/** Prefer a stored OpenSea CDN URL; otherwise the deterministic proxy. */
export function resolveTokenImageUrl(
  tokenId: string,
  storedImageUrl: string | null | undefined,
): string {
  if (storedImageUrl && /^https?:\/\//i.test(storedImageUrl)) return storedImageUrl;
  return buildTokenImageUrl(tokenId);
}
