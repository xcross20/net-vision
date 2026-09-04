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
