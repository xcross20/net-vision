/**
 * Apply one marketplace event to the index for that token only.
 */
import { facetsForToken } from '@net-vision/taxonomy';
import { applyObservation } from '../market/listing-state';
import { attributeSale } from '../market/engine';
import type { CatalogSale } from '../market/catalog';
import type { MarketEvent } from './market-event';
import {
  ingestSales,
  listingRecord,
  persistNftMetadata,
  rememberMarketEvent,
  tokenFacets,
  upsertToken,
  wasMarketEventSeen,
  writeListing,
} from './store';

export type ApplyEventResult = 'applied' | 'duplicate' | 'ignored';

export function applyMarketEvent(event: MarketEvent, now = Date.now()): ApplyEventResult {
  if (wasMarketEventSeen(event.id)) return 'duplicate';
  rememberMarketEvent(event, now);

  if (event.kind === 'listed') {
    if (event.price == null || !Number.isFinite(event.price)) return 'ignored';
    const next = applyObservation(listingRecord(event.tokenId), {
      kind: 'ask',
      price: event.price,
      currency: event.currency ?? 'USDG',
      orderHash: event.orderHash,
      seller: event.seller,
      listedAt: event.occurredAt,
    }, now);
    writeListing(next);
    return 'applied';
  }

  if (event.kind === 'cancelled') {
    const next = applyObservation(
      listingRecord(event.tokenId),
      { kind: 'cancel', orderHash: event.orderHash },
      now,
    );
    writeListing(next);
    return 'applied';
  }

  if (event.kind === 'sold') {
    const next = applyObservation(
      listingRecord(event.tokenId),
      { kind: 'cancel', orderHash: event.orderHash },
      now,
    );
    writeListing(next);
    if (event.price != null && Number.isFinite(event.price)) {
      const sale: CatalogSale = {
        tokenId: event.tokenId,
        price: event.price,
        currency: event.currency ?? 'USDG',
        occurredAt: event.occurredAt,
        orderHash: event.orderHash,
        buyer: event.buyer,
        seller: event.seller,
      };
      const facets =
        tokenFacets(event.tokenId).length > 0
          ? tokenFacets(event.tokenId)
          : facetsForToken(event.tokenId);
      ingestSales([sale], attributeSale(sale, facets));
    }
    if (event.ownerAddress) {
      upsertToken({
        tokenId: event.tokenId,
        displayNumber: event.tokenId,
        exists: true,
        name: null,
        imageUrl: null,
        ownerAddress: event.ownerAddress,
        metadataJson: null,
        metadataVerifiedAt: null,
        lastSeenAt: now,
      });
    }
    return 'applied';
  }

  if (event.kind === 'transferred') {
    if (event.ownerAddress) {
      upsertToken({
        tokenId: event.tokenId,
        displayNumber: event.tokenId,
        exists: true,
        name: null,
        imageUrl: null,
        ownerAddress: event.ownerAddress,
        metadataJson: null,
        metadataVerifiedAt: null,
        lastSeenAt: now,
      });
    }
    return 'applied';
  }

  if (event.kind === 'metadata' && event.metadata) {
    persistNftMetadata(event.tokenId, {
      name: event.metadata.name,
      imageUrl: event.metadata.imageUrl,
      ownerAddress: event.ownerAddress,
      traits: event.metadata.traits,
    });
    return 'applied';
  }

  return 'ignored';
}
