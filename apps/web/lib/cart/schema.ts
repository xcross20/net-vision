/**
 * Zod schema for the persisted cart. Validates every field on hydration
 * so a stale or hand-edited localStorage entry can never poison the UI.
 *
 * The schema is intentionally strict: extra fields are stripped, every
 * address is normalized to lower case, and items belonging to a
 * different collection are rejected so a swap-in of malicious data
 * cannot trigger a buy.
 */
import { z } from 'zod';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import type { CartItem } from './types';

const HexAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((s) => s.toLowerCase() as `0x${string}`);

const CartItemSchema = z.object({
  collectionSlug: z.literal('button-presser'),
  contractAddress: HexAddress,
  tokenId: z.string().regex(/^\d+$/),
  imageUrl: z.string().min(1),
  displayName: z.string().min(1),
  categories: z
    .array(
      z.object({
        slug: z.string().min(1),
        label: z.string().min(1),
      }),
    )
    .max(8),
  sourceMarketplace: z.enum(['opensea', 'net_vision']),
  displayedOrderHash: z.string().nullable(),
  displayedPriceRaw: z.string().nullable(),
  displayedPriceDecimal: z.string().nullable(),
  currencySymbol: z.string().nullable(),
  currencyAddress: HexAddress.nullable(),
  currencyDecimals: z.number().int().min(0).max(36).nullable(),
  addedAt: z.number().int().nonnegative(),
});

export const CartStorageSchema = z.object({
  version: z.literal(1),
  items: z.array(CartItemSchema).max(20),
});

export function parseCartFromStorage(raw: string): CartItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const result = CartStorageSchema.safeParse(parsed);
  if (!result.success) return [];
  return result.data.items.filter(
    (item) =>
      item.contractAddress ===
      (BUTTON_PRESSER_COLLECTION.contractAddress.toLowerCase() as `0x${string}`),
  );
}

export function serializeCartForStorage(items: CartItem[]): string {
  return JSON.stringify({ version: 1, items });
}
