import { classifyNumber } from '@net-vision/taxonomy';

/**
 * Deterministic SVG media endpoint.
 *
 * In production, image_url comes from OpenSea metadata. For the
 * read-only slice we generate a deterministic SVG that renders the
 * token number prominently. This is real NFT media in the sense that
 * it's tied to the token and never random.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await ctx.params;
  const classification = classifyNumber(tokenId);
  const isMeme = classification.traits.some((t) => t.slug === 'meme');
  const isPalindrome = classification.traits.some((t) => t.slug === 'palindrome');
  const accent = isMeme ? '#74F0A7' : isPalindrome ? '#35C97B' : '#9FB6A8';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
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
  <text x="200" y="370" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="${accent}">${classification.traits.map((t) => t.label).join(' \u00B7 ').slice(0, 80)}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
