import { NextResponse } from 'next/server';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { createOpenSeaClient, OpenSeaResponseError } from '@net-vision/opensea-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENSEA_API_KEY is not set' }, { status: 503 });
  }
  const client = createOpenSeaClient({
    OPENSEA_API_KEY: apiKey,
    OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
    OPENSEA_CHAIN: process.env.OPENSEA_CHAIN,
  });
  try {
    const chain = await client.resolveChainSlug();
    const listings = await client.getCollectionListings({
      slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
      limit: 3,
    });
    const stats = await client.getCollectionStats({ slug: BUTTON_PRESSER_COLLECTION.openseaSlug });
    return NextResponse.json({
      chain,
      listingsCount: listings.listings.length,
      firstListingPrice: listings.listings[0]?.price ?? null,
      stats: {
        total: stats.total,
        intervals: stats.intervals?.slice(0, 2) ?? [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof OpenSeaResponseError ? `OpenSea error ${err.status}` : String(err),
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
