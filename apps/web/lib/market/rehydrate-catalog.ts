/**
 * Replace TokenCatalog live maps from the process index store.
 * Used after a worker snapshot lands so cancels actually disappear.
 */
import { TokenCatalog } from './catalog';
import { allListingRecords, loadIndex } from '@/lib/index/store';

export function rehydrateCatalogFromIndex(catalog: TokenCatalog): void {
  catalog.resetLiveMarket();
  const snap = loadIndex();
  for (const record of allListingRecords()) {
    catalog.hydrateListingRecord(record);
  }
  for (const [tokenId, facets] of Object.entries(snap.tokenFacets ?? {})) {
    catalog.attachFacets(tokenId, facets);
  }
  catalog.ingestSales(snap.sales ?? []);
}
