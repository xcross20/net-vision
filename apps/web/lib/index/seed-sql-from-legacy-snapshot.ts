/**
 * One-time Schema V2 seed: project a legacy IndexSnapshot into
 * collection-scoped SQL without full-table DELETE.
 *
 * Does not switch request-path reads. Does not write worker_state
 * (the live worker owns cursors/heartbeats).
 */
import { CURRENT_TAXONOMY_VERSION, type TokenFacet } from '@net-vision/taxonomy';
import { saleEventId } from '../market/engine';
import { LISTING_STATES, type ListingRecord } from '../market/listing-state';
import type { CatalogSale } from '../market/catalog';
import type { IndexSnapshot, TokenRow } from './store';
import type { MarketRepository, SqlTokenMarketState } from './market-repository';
import { BUTTON_PRESSER_COLLECTION_ID } from './schema-v2';

export const LEGACY_SNAPSHOT_SOURCE = 'legacy-snapshot';

export type SeedSqlReport = {
  collectionId: string;
  snapshotRevision: number;
  listingsInSnapshot: number;
  tokensUpserted: number;
  marketInserted: number;
  marketUpdated: number;
  marketSkippedNewer: number;
  facetsReplaced: number;
  salesInserted: number;
  listingStatesInSnapshot: Record<string, number>;
};

export function snapshotListingWatermarkMs(listing: ListingRecord): number {
  const verified = listing.lastVerifiedAt;
  if (verified != null && Number.isFinite(verified) && verified > 0) return verified;
  const listed = listing.listedAt;
  if (listed != null && Number.isFinite(listed) && listed > 0) return listed;
  return 0;
}

export function shouldApplySnapshotListing(
  current: Pick<SqlTokenMarketState, 'stateEventAt' | 'lastVerifiedAt'> | null,
  snapshotWatermarkMs: number,
): boolean {
  if (!current) return true;
  if (current.stateEventAt != null && snapshotWatermarkMs < current.stateEventAt) {
    return false;
  }
  if (
    current.stateEventAt == null &&
    current.lastVerifiedAt != null &&
    snapshotWatermarkMs < current.lastVerifiedAt
  ) {
    return false;
  }
  return true;
}

function tallyStates(listings: ListingRecord[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const state of LISTING_STATES) tally[state] = 0;
  for (const row of listings) {
    tally[row.state] = (tally[row.state] ?? 0) + 1;
  }
  return tally;
}

function listingToSql(
  collectionId: string,
  listing: ListingRecord,
  watermarkMs: number,
): SqlTokenMarketState {
  return {
    collectionId,
    tokenId: Number(listing.tokenId),
    listingState: listing.state,
    orderHash: listing.orderHash,
    price: listing.price,
    currency: listing.currency,
    seller: listing.seller,
    listedAt: listing.listedAt,
    lastVerifiedAt: listing.lastVerifiedAt,
    consecutive404s: listing.consecutive404s ?? 0,
    stateEventAt: watermarkMs > 0 ? watermarkMs : null,
    stateEventId: `legacy-snapshot:${collectionId}:${listing.tokenId}`,
    stateSource: LEGACY_SNAPSHOT_SOURCE,
  };
}

export async function seedSqlFromLegacySnapshot(input: {
  repo: MarketRepository;
  snapshot: IndexSnapshot;
  collectionId?: string;
}): Promise<SeedSqlReport> {
  const collectionId = input.collectionId ?? BUTTON_PRESSER_COLLECTION_ID;
  const snap = input.snapshot;
  const listings = Object.values(snap.listings ?? {}) as ListingRecord[];
  const tokens = Object.values(snap.tokens ?? {}) as TokenRow[];
  const report: SeedSqlReport = {
    collectionId,
    snapshotRevision: snap.snapshotRevision ?? 0,
    listingsInSnapshot: listings.length,
    tokensUpserted: 0,
    marketInserted: 0,
    marketUpdated: 0,
    marketSkippedNewer: 0,
    facetsReplaced: 0,
    salesInserted: 0,
    listingStatesInSnapshot: tallyStates(listings),
  };

  const tokenById = new Map(tokens.map((t) => [t.tokenId, t]));

  for (const listing of listings) {
    const tokenId = Number(listing.tokenId);
    if (!Number.isInteger(tokenId) || tokenId < 0) continue;
    const token = tokenById.get(listing.tokenId);
    await input.repo.upsertToken({
      collectionId,
      tokenId,
      displayNumber: token?.displayNumber ?? listing.tokenId,
      exists: token?.exists ?? true,
      ownerAddress: token?.ownerAddress ?? listing.seller,
      name: token?.name ?? null,
      imageUrl: token?.imageUrl ?? null,
      metadataJson: token?.metadataJson ?? null,
      metadataVerifiedAt: token?.metadataVerifiedAt ?? null,
      lastSeenAt: token?.lastSeenAt ?? snapshotListingWatermarkMs(listing) ?? Date.now(),
    });
    report.tokensUpserted += 1;

    const current = await input.repo.getTokenMarketState(collectionId, tokenId);
    const watermarkMs = snapshotListingWatermarkMs(listing);
    if (!shouldApplySnapshotListing(current, watermarkMs)) {
      report.marketSkippedNewer += 1;
      continue;
    }
    await input.repo.upsertTokenMarketState(listingToSql(collectionId, listing, watermarkMs));
    if (current) report.marketUpdated += 1;
    else report.marketInserted += 1;
  }

  // Tokens that exist in the snapshot but have no listing row.
  for (const token of tokens) {
    if (snap.listings?.[token.tokenId]) continue;
    const tokenId = Number(token.tokenId);
    if (!Number.isInteger(tokenId) || tokenId < 0) continue;
    await input.repo.upsertToken({
      collectionId,
      tokenId,
      displayNumber: token.displayNumber,
      exists: token.exists,
      ownerAddress: token.ownerAddress,
      name: token.name,
      imageUrl: token.imageUrl,
      metadataJson: token.metadataJson,
      metadataVerifiedAt: token.metadataVerifiedAt,
      lastSeenAt: token.lastSeenAt,
    });
    report.tokensUpserted += 1;
  }

  const taxonomyVersion = snap.taxonomyVersion || `taxonomy-${CURRENT_TAXONOMY_VERSION}`;
  for (const [tokenIdStr, facets] of Object.entries(snap.tokenFacets ?? {})) {
    if (!Array.isArray(facets) || facets.length === 0) continue;
    const tokenId = Number(tokenIdStr);
    if (!Number.isInteger(tokenId) || tokenId < 0) continue;
    await input.repo.replaceTokenFacetsForToken(
      collectionId,
      tokenId,
      facets as TokenFacet[],
      taxonomyVersion,
    );
    report.facetsReplaced += 1;
  }

  const seenSales = new Set<string>();
  for (const sale of (snap.sales ?? []) as CatalogSale[]) {
    const id = saleEventId(sale);
    if (seenSales.has(id)) continue;
    seenSales.add(id);
    await input.repo.insertSale({
      collectionId,
      saleEventId: id,
      tokenId: Number(sale.tokenId),
      price: sale.price,
      currency: sale.currency,
      occurredAt: sale.occurredAt,
      orderHash: sale.orderHash,
      buyer: sale.buyer,
      seller: sale.seller,
    });
    report.salesInserted += 1;
  }

  return report;
}

export function xorTokenIds(expected: Iterable<string>, actual: Iterable<string>): {
  missingInActual: string[];
  extraInActual: string[];
} {
  const exp = new Set([...expected].map(String));
  const act = new Set([...actual].map(String));
  const missingInActual: string[] = [];
  const extraInActual: string[] = [];
  for (const id of exp) if (!act.has(id)) missingInActual.push(id);
  for (const id of act) if (!exp.has(id)) extraInActual.push(id);
  missingInActual.sort((a, b) => Number(a) - Number(b));
  extraInActual.sort((a, b) => Number(a) - Number(b));
  return { missingInActual, extraInActual };
}
