import { parseUsdgDecimalToRaw } from '../native-market/fees';
import { planBulkOffers, type BulkOfferStrategy } from '../native-market/offers';
import { parseAssetIdentity } from './identity';
import { getOfferStore, prepareNativeOffer } from './service';
import { newGroupId, type NativeOfferStore } from './store';

export const BULK_OFFER_CAP = 20;

export async function prepareBulkSamePrice(input: {
  buyer: string;
  assets: Array<{ ecosystemId?: string; collectionId?: string; tokenId: string }>;
  offerUsdgRaw: bigint;
  durationSeconds: number;
  balanceUsdgRaw: bigint;
  store?: NativeOfferStore;
  feeRecipient?: string;
}) {
  const identities = input.assets.map((asset) => parseAssetIdentity(asset));
  const seen = new Set<string>();
  const unique = identities.filter((id) => {
    if (seen.has(id.tokenId)) return false;
    seen.add(id.tokenId);
    return true;
  });
  if (unique.length > BULK_OFFER_CAP) throw new Error('offer: bulk cap is 20');
  const store = input.store ?? getOfferStore();
  const plan = planBulkOffers({
    strategy: 'SAME_PRICE' satisfies BulkOfferStrategy,
    samePriceUsdg: rawToDecimal(input.offerUsdgRaw),
    buyerBalanceUsdgRaw: input.balanceUsdgRaw,
    selections: unique.map((id) => ({ tokenId: id.tokenId, askUsdgRaw: null })),
  });
  const groupId = newGroupId();
  const startsAt = Math.floor(Date.now() / 1000);
  await store.putGroup({
    id: groupId,
    buyerAddress: input.buyer.toLowerCase() as `0x${string}`,
    strategy: 'SAME_PRICE',
    requestedAssetCount: unique.length,
    maximumLiabilityUsdgRaw: plan.maximumLiabilityUsdgRaw.toString(),
    startsAt,
    expiresAt: startsAt + input.durationSeconds,
    status: 'DRAFT',
    createdAt: Date.now(),
  });
  const prepared = [];
  for (const asset of unique) {
    prepared.push(
      await prepareNativeOffer({
        buyer: input.buyer,
        tokenId: asset.tokenId,
        ecosystemId: asset.ecosystemId,
        collectionId: asset.collectionId,
        offerUsdgRaw: input.offerUsdgRaw,
        durationSeconds: input.durationSeconds,
        balanceUsdgRaw: input.balanceUsdgRaw,
        store,
        feeRecipient: input.feeRecipient,
        offerGroupId: groupId,
      }),
    );
  }
  return { groupId, prepared, maximumLiabilityUsdgRaw: plan.maximumLiabilityUsdgRaw };
}

function rawToDecimal(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac = (raw % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac.length === 0 ? whole.toString() : `${whole.toString()}.${frac}`;
}

export { parseUsdgDecimalToRaw };
