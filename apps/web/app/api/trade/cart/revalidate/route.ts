/**
 * POST /api/trade/cart/revalidate
 *
 * For each cart item, fetch the current best OpenSea listing and
 * compare it to the snapshot the user added. Items that no longer
 * match the displayed order hash, that have changed price, or that
 * have no active listing are flagged for the review screen.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { getMarketSource } from '@/lib/market';
import { createOpenSeaClient } from '@net-vision/opensea-client';
import { CartStorageSchema } from '@/lib/cart/schema';
import type { CartItem } from '@/lib/cart/types';

export const dynamic = 'force-dynamic';

const Body = z.object({
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  items: z
    .array(
      z.object({
        tokenId: z.string().regex(/^\d+$/),
        contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        displayedOrderHash: z.string().nullable().optional(),
        displayedPriceRaw: z.string().nullable().optional(),
      }),
    )
    .max(20),
});

function toCartItem(input: z.infer<typeof Body>['items'][number]): CartItem {
  return {
    collectionSlug: 'button-presser',
    contractAddress: input.contractAddress.toLowerCase() as `0x${string}`,
    tokenId: input.tokenId,
    imageUrl: `/api/media/token/${encodeURIComponent(input.tokenId)}`,
    displayName: `#${input.tokenId}`,
    categories: [],
    sourceMarketplace: 'opensea',
    displayedOrderHash: input.displayedOrderHash ?? null,
    displayedPriceRaw: input.displayedPriceRaw ?? null,
    displayedPriceDecimal: null,
    currencySymbol: null,
    currencyAddress: null,
    currencyDecimals: null,
    addedAt: Date.now(),
  };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  // First gate: collection contract. Any non-Button Presser items are
  // dropped before we ever touch OpenSea so a hostile caller cannot
  // use this endpoint to probe orderbooks.
  const buttonPresserAddress =
    BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase();
  const inCollection = parsed.data.items.filter(
    (it) => it.contractAddress.toLowerCase() === buttonPresserAddress,
  );
  if (inCollection.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENSEA_API_KEY is not set; cart revalidation cannot run' },
      { status: 503 },
    );
  }

  // Best-effort: ensure all items are validated against the schema.
  const validated: CartItem[] = [];
  for (const it of inCollection) {
    const candidate = toCartItem(it);
    const check = CartStorageSchema.shape.items.element.safeParse(candidate);
    if (check.success) validated.push(candidate);
  }
  if (validated.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const market = getMarketSource();
  const freshness = await market.getFreshness();
  if (!freshness.resolvedChainSlug) {
    return NextResponse.json(
      { error: 'OpenSea chain slug not resolved; revalidation unavailable' },
      { status: 503 },
    );
  }
  const client = createOpenSeaClient({
    OPENSEA_API_KEY: apiKey,
    OPENSEA_BASE_URL: process.env.OPENSEA_BASE_URL,
    OPENSEA_CHAIN: freshness.resolvedChainSlug,
  });

  const results = await Promise.all(
    validated.map(async (item): Promise<RevalidateResult> => {
      try {
        const listing = await client.getBestListing({
          slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
          tokenId: item.tokenId,
        });
        if (!listing) {
          return { tokenId: item.tokenId, state: 'unavailable', cartItem: item, reason: 'no_listing' };
        }
        const now = Math.floor(Date.now() / 1000);
        const validUntil = parseEpoch(listing.protocol_data.parameters.endTime);
        if (validUntil !== null && validUntil <= now) {
          return { tokenId: item.tokenId, state: 'unavailable', cartItem: item, reason: 'expired' };
        }
        const priceRaw = String(
          (listing.price as { current?: { value?: string | number } }).current?.value ?? '0',
        );
        const decimals =
          (listing.price as { current?: { decimals?: number } }).current?.decimals ?? 0;
        const priceDecimal = Number(priceRaw) / 10 ** decimals;
        const currency =
          (listing.price as { current?: { currency?: string } }).current?.currency ?? 'ETH';
        const priceChanged =
          item.displayedPriceRaw !== null && item.displayedPriceRaw !== priceRaw;
        const orderChanged =
          item.displayedOrderHash !== null &&
          item.displayedOrderHash !== listing.order_hash;
        return {
          tokenId: item.tokenId,
          state: 'valid',
          cartItem: item,
          liveOrderHash: listing.order_hash,
          livePriceRaw: priceRaw,
          livePriceDecimal: priceDecimal,
          livePriceDisplay: `${priceDecimal.toFixed(Math.min(decimals, 4))} ${currency}`,
          liveCurrency: currency,
          liveProtocolAddress: listing.protocol_address,
          liveValidUntil: validUntil,
          // Treat an order-hash swap as a price change for review purposes:
          // the user must explicitly accept the new seller / order.
          priceChanged: priceChanged || orderChanged,
        };
      } catch (err) {
        if (err instanceof Error && /404/.test(err.message)) {
          return {
            tokenId: item.tokenId,
            state: 'unavailable',
            cartItem: item,
            reason: 'sold',
          };
        }
        return {
          tokenId: item.tokenId,
          state: 'error',
          cartItem: item,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return NextResponse.json({ items: results });
}

function parseEpoch(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

type RevalidateResult =
  | {
      tokenId: string;
      state: 'valid';
      cartItem: CartItem;
      liveOrderHash: string;
      livePriceRaw: string;
      livePriceDecimal: number;
      livePriceDisplay: string;
      liveCurrency: string;
      liveProtocolAddress: string;
      liveValidUntil: number | null;
      priceChanged: boolean;
    }
  | {
      tokenId: string;
      state: 'unavailable';
      cartItem: CartItem;
      reason: 'sold' | 'expired' | 'no_listing' | 'unsupported_order';
    }
  | { tokenId: string; state: 'error'; cartItem: CartItem; message: string };
