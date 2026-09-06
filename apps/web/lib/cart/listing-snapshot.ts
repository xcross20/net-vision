/**
 * Snapshot the listing identity the shopper actually saw.
 * Revalidation compares this against the live OpenSea order.
 */
import { PAYMENT_TOKENS } from '@net-vision/chain-config';
import type { Token } from '@/lib/market';
import type { CartItemDraft } from './types';

export function cartDraftFromToken(token: Token): CartItemDraft {
  const decimals = token.listingCurrencyDecimals ?? PAYMENT_TOKENS.USDG.decimals;
  const raw =
    token.listingPriceRaw ??
    (token.listingPrice != null && Number.isFinite(token.listingPrice)
      ? Math.round(token.listingPrice * 10 ** decimals).toString()
      : null);
  return {
    token,
    displayedOrderHash: token.listingOrderHash ?? null,
    displayedPriceRaw: raw,
    displayedPriceDecimal: token.listingPrice != null ? String(token.listingPrice) : null,
    currencySymbol: token.currency,
    currencyAddress: token.listingCurrencyAddress ?? PAYMENT_TOKENS.USDG.contractAddress,
    currencyDecimals: decimals,
  };
}
