import { NextResponse } from 'next/server';
import {
  createDiagnosticOpenSeaClient,
  fetchRawNftForIdentity,
} from '@/lib/market/diagnostic';

export const dynamic = 'force-dynamic';

console.log('[diag] module loaded');

/**
 * Diagnostic endpoint used by the number-identity probe. Returns the raw
 * OpenSea NFT fields so we can verify that the contract tokenId equals
 * the displayed Presser number and the OpenSea `identifier`. Never link
 * from public pages; the data is intended for offline fixture generation
 * (`scripts/probe-number-identity.ts`) and not for production UI.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ tokenId: string }> },
) {
  console.log('[diag] GET called');
  const { tokenId } = await ctx.params;
  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json({ error: 'tokenId must be a positive integer string' }, { status: 400 });
  }

  if (!process.env.OPENSEA_API_KEY) {
    return NextResponse.json(
      { error: 'OPENSEA_API_KEY not configured on this server' },
      { status: 503 },
    );
  }

  let client;
  try {
    client = createDiagnosticOpenSeaClient();
  } catch (err) {
    return NextResponse.json(
      { error: 'diagnostic client init failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }

  const sample = await fetchRawNftForIdentity(client, tokenId);
  if (sample.identifier === null) {
    return NextResponse.json({ error: 'nft not found or lookup failed', sample }, { status: 404 });
  }
  return NextResponse.json(sample);
}