/**
 * Production token reads.
 *
 * Reads go through the MarketSource. The seed dataset is preserved
 * under `lib/data/__fixtures__` for local UI iteration and adversarial
 * tests, but is never served by production routes.
 */

import { getMarketSource } from '@/lib/market';
import type { Token } from '@/lib/market';

export type { Token } from '@/lib/market';

export async function getToken(tokenId: string): Promise<Token | null> {
  return getMarketSource().getToken(tokenId);
}

export async function listTokens(filter?: {
  category?: string;
  limit?: number;
  listedOnly?: boolean;
}): Promise<Token[]> {
  const page = await getMarketSource().listTokens(filter);
  return page.tokens;
}

export async function getCollectionMetadata() {
  const snapshot = await getMarketSource().getCollectionSnapshot();
  return {
    name: snapshot.name,
    slug: snapshot.slug,
    contractAddress: snapshot.contractAddress,
    tokenStandard: 'ERC721' as const,
    chainSlug: snapshot.openseaChainSlug,
  };
}

export async function getCollectionSnapshot() {
  return getMarketSource().getCollectionSnapshot();
}

export async function getRecentSales(limit = 20) {
  return getMarketSource().listRecentSales(limit);
}

export async function getRecentOffers(limit = 20) {
  return getMarketSource().listRecentOffers(limit);
}
