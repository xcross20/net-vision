/**
 * Official on-chain SVG for a Button Presser. Never fabricates Plate art.
 * Missing cache → honest pending image, not a derived-trait poster.
 */
import { isOfficialExistingTokenId } from '@net-vision/chain-config';
import { loadCanonicalMedia } from '@/lib/index/canonical-metadata-store';
import { ensureSchema, databaseUrl } from '@/lib/index/pg';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await ctx.params;
  const n = Number(tokenId);
  if (!isOfficialExistingTokenId(n)) {
    return new Response('not an official Button Presser token', { status: 404 });
  }
  if (databaseUrl()) {
    try {
      await ensureSchema();
      const media = await loadCanonicalMedia(n);
      if (media) {
        return new Response(new Uint8Array(media.body), {
          headers: {
            'content-type': media.contentType,
            'cache-control': 'public, max-age=86400',
          },
        });
      }
    } catch {
      /* fall through to pending */
    }
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="400" height="400" fill="#08110D"/>
  <text x="200" y="190" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" fill="#9FB6A8">Image pending</text>
  <text x="200" y="230" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="28" fill="#EAF5EE">#${escapeXml(tokenId)}</text>
  <text x="200" y="360" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="#6B7F74">Official metadata not cached yet</text>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=30',
      'x-nv-media': 'pending',
    },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
