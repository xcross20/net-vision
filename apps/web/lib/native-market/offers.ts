/**
 * Bulk offers: one user action, many independently valid Seaport bids,
 * grouped by Net Vision as an OfferGroup.
 *
 * V1 does not use criteria/Merkle offers. Each selected token gets its
 * own USDG bid. Settlement is independent; cancellation is per-order or
 * remaining-group.
 */
import { BUTTON_PRESSER_COLLECTION, isOfficialExistingTokenId } from '@net-vision/chain-config';
import { parseUsdgDecimalToRaw, USDG_UNIT } from './fees';

export const BULK_OFFER_CAP = 20;

export type BulkOfferStrategy =
  | 'SAME_PRICE'
  | 'PERCENT_BELOW_ASK'
  | 'PERCENT_BELOW_FLOOR'
  | 'CUSTOM';

export type BulkOfferSelection = {
  tokenId: string;
  askUsdgRaw: bigint | null;
};

export type BulkOfferPlanInput = {
  strategy: BulkOfferStrategy;
  selections: BulkOfferSelection[];
  samePriceUsdg?: string;
  percentBelowAskBps?: bigint;
  percentBelowFloorBps?: bigint;
  floorUsdgRaw?: bigint;
  customUsdgByTokenId?: Record<string, string>;
  buyerBalanceUsdgRaw: bigint;
};

export type PlannedNativeOffer = {
  ecosystemId: 'helix';
  collectionId: 'button-presser';
  contractAddress: `0x${string}`;
  tokenId: string;
  offerUsdgRaw: bigint;
};

export type BulkOfferPlan = {
  strategy: BulkOfferStrategy;
  offers: PlannedNativeOffer[];
  maximumLiabilityUsdgRaw: bigint;
};

export function planBulkOffers(input: BulkOfferPlanInput): BulkOfferPlan {
  const unique = dedupeSelections(input.selections);
  if (unique.length === 0) throw new Error('bulk-offer: no tokens selected');
  if (unique.length > BULK_OFFER_CAP) throw new Error('bulk-offer: exceeds 20-offer cap');

  const offers = unique.map((selection) => {
    const tokenIdNum = Number(selection.tokenId);
    if (!isOfficialExistingTokenId(tokenIdNum)) {
      throw new Error(`bulk-offer: ${selection.tokenId} is not an official Button Presser`);
    }
    const offerUsdgRaw = offerAmount(input, selection);
    if (offerUsdgRaw <= 0n) throw new Error(`bulk-offer: ${selection.tokenId} offer must be positive`);
    return {
      ecosystemId: 'helix' as const,
      collectionId: 'button-presser' as const,
      contractAddress: BUTTON_PRESSER_COLLECTION.contractAddress,
      tokenId: String(tokenIdNum),
      offerUsdgRaw,
    };
  });

  const maximumLiabilityUsdgRaw = offers.reduce((sum, row) => sum + row.offerUsdgRaw, 0n);
  if (input.buyerBalanceUsdgRaw < maximumLiabilityUsdgRaw) {
    throw new Error('bulk-offer: underfunded aggregate exposure');
  }
  return { strategy: input.strategy, offers, maximumLiabilityUsdgRaw };
}

function offerAmount(input: BulkOfferPlanInput, selection: BulkOfferSelection): bigint {
  switch (input.strategy) {
    case 'SAME_PRICE':
      if (!input.samePriceUsdg) throw new Error('bulk-offer: same price required');
      return parseUsdgDecimalToRaw(input.samePriceUsdg);
    case 'PERCENT_BELOW_ASK': {
      if (selection.askUsdgRaw == null || selection.askUsdgRaw <= 0n) {
        throw new Error(`bulk-offer: ${selection.tokenId} has no ask`);
      }
      const bps = input.percentBelowAskBps ?? 0n;
      if (bps <= 0n || bps >= 10_000n) throw new Error('bulk-offer: percent below ask out of range');
      return (selection.askUsdgRaw * (10_000n - bps)) / 10_000n;
    }
    case 'PERCENT_BELOW_FLOOR': {
      if (input.floorUsdgRaw == null || input.floorUsdgRaw <= 0n) {
        throw new Error('bulk-offer: floor required');
      }
      const bps = input.percentBelowFloorBps ?? 0n;
      if (bps <= 0n || bps >= 10_000n) throw new Error('bulk-offer: percent below floor out of range');
      return (input.floorUsdgRaw * (10_000n - bps)) / 10_000n;
    }
    case 'CUSTOM': {
      const raw = input.customUsdgByTokenId?.[selection.tokenId];
      if (!raw) throw new Error(`bulk-offer: missing custom price for ${selection.tokenId}`);
      return parseUsdgDecimalToRaw(raw);
    }
    default:
      throw new Error('bulk-offer: unknown strategy');
  }
}

function dedupeSelections(selections: BulkOfferSelection[]): BulkOfferSelection[] {
  const seen = new Set<string>();
  const out: BulkOfferSelection[] = [];
  for (const row of selections) {
    if (seen.has(row.tokenId)) continue;
    seen.add(row.tokenId);
    out.push(row);
  }
  return out;
}

export function usdgRawFromDecimalPrice(price: number): bigint {
  if (!Number.isFinite(price) || price <= 0) return 0n;
  return BigInt(Math.round(price * Number(USDG_UNIT)));
}
