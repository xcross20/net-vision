import { classifyNumber } from '@net-vision/taxonomy';

/**
 * Deterministic SVG media endpoint.
 *
 * Three modes driven by the optional `?state=` query parameter:
 *   - `verified` (default for tokens with verified metadata but no image)
 *       Renders the trait-aware "Image unavailable" SVG (used when the
 *       metadata walker verified the token but OpenSea returned no
 *       image_url).
 *   - `unverified` (default for tokens the metadata walker hasn't reached)
 *       Renders the honest "Image pending" frame with the token number.
 *       No fabricated trait labels — the user sees a clear data gap.
 *   - `missing` (alias for verified; kept for clarity at call sites)
 */
type ProxyState = 'verified' | 'unverified' | 'missing';

function readState(searchParams: URLSearchParams | null): ProxyState {
  const raw = searchParams?.get('state');
  if (raw === 'unverified' || raw === 'verified' || raw === 'missing') return raw;
  // Backwards-compatible default: trait-aware fallback. The marketplace
  // cards now opt into "unverified" explicitly when metadata is not yet
  // verified. Old direct callers still get the legacy SVG.
  return 'verified';
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await ctx.params;
  const state = readState(new URL(request.url).searchParams);
  const svg = state === 'unverified' ? renderPendingSvg(tokenId) : renderVerifiedSvg(tokenId);
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

function renderVerifiedSvg(tokenId: string): string {
  const classification = classifyNumber(tokenId);
  const isMeme = classification.traits.some((t) => t.slug === 'meme');
  const isPalindrome = classification.traits.some((t) => t.slug === 'palindrome');
  const accent = isMeme ? '#74F0A7' : isPalindrome ? '#35C97B' : '#9FB6A8';
  const caption = classification.traits.map((t) => t.label).join(' \u00B7 ').slice(0, 80) || 'Image unavailable';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#14231B"/>
      <stop offset="100%" stop-color="#08110D"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <rect x="20" y="20" width="360" height="360" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"/>
  <text x="200" y="220" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="84" font-weight="700" fill="#EAF5EE">${escapeXml(tokenId)}</text>
  <text x="200" y="260" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" letter-spacing="2" fill="#9FB6A8">BUTTON PRESSER</text>
  <text x="200" y="370" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="${accent}">${escapeXml(caption)}</text>
</svg>`;
}

function renderPendingSvg(tokenId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#0E1814"/>
      <stop offset="100%" stop-color="#070B09"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#g)"/>
  <rect x="20" y="20" width="360" height="360" fill="none" stroke="#1F2B25" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="6 6"/>
  <text x="200" y="210" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="64" font-weight="600" fill="#5C7066">${escapeXml(tokenId)}</text>
  <text x="200" y="250" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" letter-spacing="2" fill="#3D4D44">BUTTON PRESSER</text>
  <text x="200" y="310" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" letter-spacing="1.5" fill="#6B8077">Image pending</text>
  <text x="200" y="330" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" letter-spacing="1" fill="#3D4D44">metadata not yet verified</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
