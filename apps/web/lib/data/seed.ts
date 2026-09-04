/**
 * Deterministic seed of Button Presser tokens for the read-only slice.
 *
 * In production this data comes from the OpenSea read gateway and the
 * indexer. For the read-only slice we ship a curated, deterministic
 * dataset that exercises every category so the UI is meaningful
 * without requiring live API credentials.
 *
 * The shape here mirrors what the production `tokens` and `market_orders`
 * tables will produce. When the live indexer lands, only this module
 * needs to change.
 */

import { classifyNumber } from '@net-vision/taxonomy';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';

export type SeededToken = {
  tokenId: string;
  ownerAddress: string;
  /** Mock OpenSea image_url. Real values come from OpenSea metadata. */
  imageUrl: string;
  /** ETH price as decimal string. null = not listed. */
  listingPriceEth: string | null;
  /** Last sale price in ETH. null = no recorded sale. */
  lastSalePriceEth: string | null;
  /** Trait slugs that apply. */
  traits: ReturnType<typeof classifyNumber>['traits'];
};

/**
 * The token numbers in this curated slice. Each is selected to exercise
 * at least one structural or cultural category, and to give every
 * category page something meaningful to display.
 */
const SEED_TOKEN_IDS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '10', '11', '12', '13', '21', '22', '23', '33', '42', '55', '69', '77', '88', '99',
  '100', '101', '111', '121', '123', '200', '222', '250', '303', '321', '333', '404', '420', '444', '500',
  '555', '600', '666', '696', '699', '777', '800', '808', '888', '999',
  '1000', '1001', '1111', '1234', '1337', '2025', '2222', '2345', '3000', '3333', '3456', '4000',
  '4321', '4444', '5000', '5555', '6000', '6666', '6789', '6969', '7000', '7777', '8000', '8008', '8888', '9000',
  '9876', '9999',
  '10000', '10001', '10101', '11111', '12345', '13579', '20000', '22222', '30000', '33333', '40000', '42000',
  '43210', '44444', '50000', '54321', '55555', '60000', '66666', '67890', '70000', '77777', '80000', '80085',
  '88888', '90000', '98765', '99999',
];

// Deterministic pseudo-random based on the token number so the same
// token always has the same listing price in the seeded slice. This is
// NOT randomness; it is a stable function the indexer can replicate.
function stablePrice(tokenId: string, scale: number): string {
  let h = 2166136261;
  for (let i = 0; i < tokenId.length; i++) {
    h ^= tokenId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) / 0xffffffff;
  const base = 0.05 + r * 5; // 0.05 to 5.05 ETH
  return (base * scale).toFixed(4);
}

function deterministicOwner(tokenId: string): string {
  // Build a deterministic but invalid-looking 0x address. The first 8
  // hex chars after 0x come from a stable hash. This is not a real
  // wallet; production resolves the actual owner from the chain.
  let h = 5381;
  for (let i = 0; i < tokenId.length; i++) {
    h = ((h << 5) + h + tokenId.charCodeAt(i)) >>> 0;
  }
  const hex = h.toString(16).padStart(8, '0');
  return `0x${hex}${'0'.repeat(32)}`.slice(0, 42);
}

function buildImageUrl(tokenId: string): string {
  // The image is a deterministic SVG so it works without external
  // requests. The endpoint is local so it never touches OpenSea.
  return `/api/media/token/${encodeURIComponent(tokenId)}`;
}

let cachedTokens: SeededToken[] | null = null;

export function getSeededTokens(): SeededToken[] {
  if (cachedTokens) return cachedTokens;
  const tokens: SeededToken[] = SEED_TOKEN_IDS.map((tokenId) => {
    const classification = classifyNumber(tokenId);
    // Roughly 60% listed, prices scale with rarity (more digits = cheaper,
    // special patterns = premium). This is illustrative only.
    const isRare =
      classification.traits.some((t) =>
        ['palindrome', 'repdigit', 'meme', 'mirror-sequence'].includes(t.slug),
      );
    const digitCount = classification.digitCount;
    const scale = isRare ? 4 + digitCount * 0.5 : 0.5 + digitCount * 0.3;
    const listed = ((parseInt(tokenId, 10) * 2654435761) >>> 0) % 10 < 6;
    const priceRaw = stablePrice(tokenId, scale);
    const lastSale = (parseInt(tokenId, 10) * 40503) >>> 0;
    const hadSale = lastSale % 7 < 4;
    const salePrice = hadSale ? stablePrice(tokenId, scale * 0.85) : null;

    return {
      tokenId,
      ownerAddress: deterministicOwner(tokenId),
      imageUrl: buildImageUrl(tokenId),
      listingPriceEth: listed ? priceRaw : null,
      lastSalePriceEth: salePrice,
      traits: classification.traits,
    };
  });
  cachedTokens = tokens;
  return tokens;
}

export function getSeededToken(tokenId: string): SeededToken | null {
  const tokens = getSeededTokens();
  return tokens.find((t) => t.tokenId === tokenId) ?? null;
}

export function getSeededTotalSupply(): number {
  return SEED_TOKEN_IDS.length;
}

export function getCollectionMetadata() {
  return {
    name: BUTTON_PRESSER_COLLECTION.name,
    slug: BUTTON_PRESSER_COLLECTION.openseaSlug,
    contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
    tokenStandard: BUTTON_PRESSER_COLLECTION.tokenStandard,
  };
}
