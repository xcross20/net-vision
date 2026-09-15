import { z } from 'zod';

/** Shared with POST /api/trade/buy/prepare. Exported so tests pin the bind. */
export const BuyPrepareBody = z.object({
  tokenId: z.string().regex(/^\d+$/),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  acceptedPriceRaw: z.string().regex(/^\d+$/),
  acceptedOrderHash: z.string().min(1),
});
