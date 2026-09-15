/**
 * Canonical cart/checkout asset identity. Membership comparisons must
 * use contract + tokenId so a later collection (Gear) cannot collide
 * on tokenId alone.
 */
export type CartAssetRef = {
  contractAddress: string;
  tokenId: string;
};

export function cartAssetId(asset: CartAssetRef): string {
  return `${asset.contractAddress.toLowerCase()}:${asset.tokenId}`;
}

export function sameCartAsset(a: CartAssetRef, b: CartAssetRef): boolean {
  return cartAssetId(a) === cartAssetId(b);
}

export function cartMembershipSet(items: ReadonlyArray<CartAssetRef>): Set<string> {
  return new Set(items.map(cartAssetId));
}
