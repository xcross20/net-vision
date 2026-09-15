/**
 * Collection-aware asset identity for native offers.
 * Never key an offer on a bare tokenId.
 *
 * The persisted ecosystem id is `helix` (schema v2 / Helix). Product
 * language is NetNet. Do not invent a second ecosystem row.
 */
import { BUTTON_PRESSER_COLLECTION, isOfficialExistingTokenId } from '@net-vision/chain-config';
import {
  BUTTON_PRESSER_COLLECTION_ID,
  HELIX_ECOSYSTEM_ID,
} from '../index/schema-v2';

export const OFFER_ECOSYSTEM_ID = HELIX_ECOSYSTEM_ID;
export const OFFER_COLLECTION_ID = BUTTON_PRESSER_COLLECTION_ID;

export type AssetIdentity = {
  ecosystemId: typeof OFFER_ECOSYSTEM_ID;
  collectionId: typeof OFFER_COLLECTION_ID;
  tokenId: string;
};

export function assetKey(asset: AssetIdentity): string {
  return `${asset.ecosystemId}:${asset.collectionId}:${asset.tokenId}`;
}

export function parseAssetIdentity(input: {
  ecosystemId?: string;
  collectionId?: string;
  tokenId?: string;
}): AssetIdentity {
  const tokenId = input.tokenId?.trim() ?? '';
  const tokenIdNum = Number(tokenId);
  if (!/^\d+$/.test(tokenId) || !isOfficialExistingTokenId(tokenIdNum)) {
    throw new Error('offer: token is outside the official Button Presser universe');
  }
  const ecosystemId = input.ecosystemId ?? OFFER_ECOSYSTEM_ID;
  const collectionId = input.collectionId ?? OFFER_COLLECTION_ID;
  if (ecosystemId !== OFFER_ECOSYSTEM_ID) {
    throw new Error('offer: unsupported ecosystem');
  }
  if (collectionId !== OFFER_COLLECTION_ID) {
    throw new Error('offer: unsupported collection');
  }
  return {
    ecosystemId: OFFER_ECOSYSTEM_ID,
    collectionId: OFFER_COLLECTION_ID,
    tokenId: String(tokenIdNum),
  };
}

export function buttonPresserContract(): `0x${string}` {
  return BUTTON_PRESSER_COLLECTION.contractAddress;
}
