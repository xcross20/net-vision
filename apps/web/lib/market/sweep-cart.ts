/**
 * Sweep add-to-cart uses the authoritative preview payload, never the
 * currently loaded category page.
 */
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { canonicalTokenImageUrl } from '../data/media';
import type { CartItemDraft } from '../cart/types';
import type { Token } from './types';
import type { SweepPreview, SweepPreviewItem } from './engine';

export function sweepPreviewToCartDrafts(preview: SweepPreview): CartItemDraft[] {
  return preview.items.map((item) => ({
    token: tokenFromSweepItem(item),
    displayedPriceDecimal: String(item.price),
    displayedOrderHash: item.orderHash,
    displayedPriceRaw: item.listingPriceRaw ?? null,
    currencySymbol: item.currency,
    sourceMarketplace: 'opensea',
  }));
}

export function assertSweepCartMatchesPreview(
  preview: SweepPreview,
  addedTokenIds: string[],
): void {
  if (addedTokenIds.length !== preview.count) {
    throw new Error(
      `sweep: preview selected ${preview.count} but cart received ${addedTokenIds.length}. No silent drop.`,
    );
  }
  const previewIds = preview.items.map((item) => item.tokenId);
  for (let i = 0; i < previewIds.length; i += 1) {
    if (addedTokenIds[i] !== previewIds[i]) {
      throw new Error('sweep: cart membership does not match preview order');
    }
  }
}

function tokenFromSweepItem(item: SweepPreviewItem): Token {
  const tokenId = item.tokenId;
  return {
    tokenId,
    contractAddress: item.contractAddress ?? BUTTON_PRESSER_COLLECTION.contractAddress,
    chainId: item.chainId ?? ROBINHOOD_CHAIN.id,
    imageUrl: item.imageUrl && item.imageUrl.length > 0 ? item.imageUrl : canonicalTokenImageUrl(tokenId),
    name: item.name ?? `#${tokenId}`,
    listingPrice: item.price,
    currency: item.currency,
    listingOrderHash: item.orderHash,
    listingPriceRaw: item.listingPriceRaw ?? null,
    lastSalePrice: null,
    ownerAddress: null,
    traits: [],
    rarityRank: null,
    listedAt: null,
    lastSaleAt: null,
  };
}
