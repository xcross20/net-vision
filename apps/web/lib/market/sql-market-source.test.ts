import { describe, expect, it } from 'vitest';
import type { TokenFacet } from '@net-vision/taxonomy';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { MemoryMarketRepository } from '../index/memory-market-repository';
import { MemoryMarketReadRepository } from '../index/market-read-repository';
import { BUTTON_PRESSER_COLLECTION_ID } from '../index/schema-v2';
import { DISCOVERY_ENVELOPE_PHANTOM_IDS } from '../index/canonical-universe';
import { SqlMarketSource } from './sql-market-source';
import { categoryResponse } from './category-contract';
import type { ListingState } from './listing-state';
import type { SqlTokenMarketState } from '../index/market-repository';

const CID = BUTTON_PRESSER_COLLECTION_ID;

function facet(tokenId: number, slug: string, family: TokenFacet['family'] = 'number'): TokenFacet {
  return {
    tokenId: String(tokenId),
    family,
    slug,
    label: slug,
    source: family === 'material' ? 'metadata' : 'derived',
    sourceVersion: 'taxonomy-test',
  };
}

function state(
  tokenId: number,
  listingState: ListingState,
  price: number | null,
): SqlTokenMarketState {
  return {
    collectionId: CID,
    tokenId,
    listingState,
    orderHash: listingState === 'LISTED' ? `0x${tokenId}` : null,
    price,
    currency: 'USDG',
    seller: '0xabc',
    listedAt: listingState === 'LISTED' ? 1 : null,
    lastVerifiedAt: 1,
    consecutive404s: 0,
    stateEventAt: 1,
    stateEventId: `evt-${tokenId}`,
    stateSource: 'opensea',
  };
}

async function seedToken(
  mem: MemoryMarketRepository,
  tokenId: number,
  listingState: ListingState,
  price: number | null,
  slugs: string[],
  family: TokenFacet['family'] = 'number',
) {
  await mem.upsertToken({
    collectionId: CID,
    tokenId,
    displayNumber: String(tokenId),
    exists: true,
    ownerAddress: '0xabc',
    name: null,
    imageUrl: null,
    metadataJson: null,
    metadataVerifiedAt: null,
    lastSeenAt: 1,
  });
  await mem.replaceTokenFacetsForToken(
    CID,
    tokenId,
    slugs.map((slug) => facet(tokenId, slug, family)),
    'taxonomy-test',
  );
  await mem.upsertTokenMarketState(state(tokenId, listingState, price));
}

describe('SqlMarketSource', () => {
  it('does not blank a LISTED floor when an unrelated member is STALE', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 41, ['digits-1']);
    await seedToken(mem, 2, 'LISTED', 99, ['digits-1']);
    await seedToken(mem, 3, 'STALE', 10, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const metrics = await source.getCategoryMetrics('digits-1');
    expect(metrics?.floorPrice).toBe(41);
    expect(metrics?.listedCount).toBe(2);
    expect(metrics?.staleListedCount).toBe(1);
    expect(metrics?.marketStatus).toBe('live');
    const api = categoryResponse(metrics!, 1, { includeFloorWhileSyncing: true });
    expect(api.market.floor).toBe(41);
  });

  it('labels a stale floor-defining listing as last-known, not current floor', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'STALE', 41, ['digits-1']);
    await seedToken(mem, 2, 'UNLISTED_VERIFIED', null, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const metrics = await source.getCategoryMetrics('digits-1');
    expect(metrics?.floorPrice).toBeNull();
    expect(metrics?.lastKnownFloorPrice).toBe(41);
    expect(metrics?.listedCount).toBe(0);
    expect(metrics?.marketStatus).toBe('live');
  });

  it('keeps bootstrap live when every member ages to STALE', async () => {
    const mem = new MemoryMarketRepository();
    for (let id = 1; id <= 9; id += 1) {
      await seedToken(mem, id, 'STALE', 100 + id, ['digits-1']);
    }
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const metrics = await source.getCategoryMetrics('digits-1');
    expect(metrics?.bootstrapCoverage).toBe(1);
    expect(metrics?.marketStatus).toBe('live');
    expect(metrics?.listedCount).toBe(0);
    expect(metrics?.floorPrice).toBeNull();
    expect(metrics?.lastKnownFloorPrice).toBe(101);
  });

  it('updates one category from a single token listing without touching an unrelated category', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 11, 'UNLISTED_VERIFIED', null, ['digits-2', 'repdigit']);
    await seedToken(mem, 12, 'UNLISTED_VERIFIED', null, ['digits-2']);
    const reads = new MemoryMarketReadRepository(mem);
    const source = new SqlMarketSource(reads);
    const beforeRep = await source.getCategoryMetrics('repdigit');
    const beforeDigits = await source.getCategoryMetrics('digits-2');
    expect(beforeRep?.listedCount).toBe(0);
    expect(beforeDigits?.listedCount).toBe(0);

    await mem.upsertTokenMarketState(state(11, 'LISTED', 77));

    const afterRep = await source.getCategoryMetrics('repdigit');
    const afterDigits = await source.getCategoryMetrics('digits-2');
    expect(afterRep?.listedCount).toBe(1);
    expect(afterRep?.floorPrice).toBe(77);
    expect(afterDigits?.listedCount).toBe(1);
    expect(afterDigits?.floorPrice).toBe(77);
  });

  it('applies cancel to listedCount and floor; unrelated category stays put', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 11, 'LISTED', 77, ['digits-2', 'repdigit']);
    await seedToken(mem, 22, 'LISTED', 50, ['digits-2']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    expect((await source.getCategoryMetrics('repdigit'))?.listedCount).toBe(1);

    await mem.upsertTokenMarketState(state(11, 'UNLISTED_VERIFIED', null));

    const rep = await source.getCategoryMetrics('repdigit');
    const digits = await source.getCategoryMetrics('digits-2');
    expect(rep?.listedCount).toBe(0);
    expect(rep?.floorPrice).toBeNull();
    expect(digits?.listedCount).toBe(1);
    expect(digits?.floorPrice).toBe(50);
  });

  it('excludes discovery-envelope token ids from listed and floor', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 569, ['material-brass'], 'material');
    for (const phantom of DISCOVERY_ENVELOPE_PHANTOM_IDS) {
      await seedToken(mem, phantom, 'LISTED', 1, ['material-brass'], 'material');
    }
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const brass = await source.getCategoryMetrics('material-brass');
    expect(brass?.listedCount).toBe(1);
    expect(brass?.floorPrice).toBe(569);
    const listed = await source.listTokens({ category: 'material-brass', listedOnly: true, limit: 10 });
    expect(listed.tokens.map((t) => t.tokenId)).toEqual(['1']);
  });

  it('lists cheapest collection-wide LISTED tokens when no category is given', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 50, ['digits-1']);
    await seedToken(mem, 2, 'LISTED', 10, ['digits-1']);
    await seedToken(mem, 3, 'UNLISTED_VERIFIED', null, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const page = await source.listTokens({ listedOnly: true, limit: 8 });
    expect(page.tokens.map((t) => t.tokenId)).toEqual(['2', '1']);
    expect(page.total).toBe(2);
  });

  it('sets OpenSea chain slug on SQL freshness so buy prepare can resolve a chain', async () => {
    const mem = new MemoryMarketRepository();
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const freshness = await source.getFreshness();
    expect(freshness.source).toBe('sql');
    expect(freshness.resolvedChainSlug).toBe('robinhood');
  });

  it('does not treat missing owner index as an empty wallet', async () => {
    const mem = new MemoryMarketRepository();
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    await expect(source.listAccountTokens('0x0000000000000000000000000000000000000abc')).rejects.toThrow(
      /unavailable|owner_address/i,
    );
  });

  it('returns owned tokens when owner_address is present', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 41, ['digits-1']);
    await seedToken(mem, 2, 'UNLISTED_VERIFIED', null, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const tokens = await source.listAccountTokens('0xabc');
    expect(tokens.map((t) => t.tokenId).sort()).toEqual(['1', '2']);
  });

  it('stamps OpenSea chain slug on the collection snapshot', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 41, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const snapshot = await source.getCollectionSnapshot();
    expect(snapshot.openseaChainSlug).toBe('robinhood');
    expect(typeof snapshot.snapshotRevision).toBe('number');
  });

  it('does not treat UNKNOWN as unlisted or as listed', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'UNKNOWN', null, ['digits-1']);
    await seedToken(mem, 2, 'UNLISTED_VERIFIED', null, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const metrics = await source.getCategoryMetrics('digits-1');
    expect(metrics?.listedCount).toBe(0);
    expect(metrics?.unknownCount).toBe(1);
    expect(metrics?.verifiedCount).toBe(1);
  });

  it('keeps persisted LISTED knowledge when realtime health is offline', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 41, ['digits-1']);
    const reads = new MemoryMarketReadRepository(mem);
    reads.setHealth({ workerOnline: false, streamConnected: false, heartbeatAgeMs: 120_000 });
    const source = new SqlMarketSource(reads);
    const metrics = await source.getCategoryMetrics('digits-1');
    expect(metrics?.realtimeHealth).toBe('offline');
    expect(metrics?.listedCount).toBe(1);
    expect(metrics?.floorPrice).toBe(41);
    const snapshot = await source.getCollectionSnapshot();
    expect(snapshot.realtimeHealth).toBe('offline');
    expect(snapshot.listedCount).toBe(1);
    expect(snapshot.floorPrice).toBe(41);
    expect(snapshot.totalSupply).toBe(BUTTON_PRESSER_COLLECTION.officialExistingSupply);
  });

  it('reads collection and category sales and ignores envelope token sales', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 41, ['digits-1']);
    const now = Date.now();
    await mem.insertSale({
      collectionId: CID,
      saleEventId: 'sale:1',
      tokenId: 1,
      price: 80,
      currency: 'USDG',
      occurredAt: now,
      orderHash: '0xsale1',
      buyer: '0xbuy',
      seller: '0xsel',
    });
    await mem.insertSaleAttributions([
      {
        collectionId: CID,
        saleEventId: 'sale:1',
        tokenId: 1,
        categorySlug: 'digits-1',
        taxonomyVersion: 'taxonomy-test',
        facetSource: 'derived',
        attributedPrice: 80,
        occurredAt: now,
      },
    ]);
    await mem.insertSale({
      collectionId: CID,
      saleEventId: 'sale:phantom',
      tokenId: 62094,
      price: 1,
      currency: 'USDG',
      occurredAt: now,
      orderHash: null,
      buyer: null,
      seller: null,
    });
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const recent = await source.listRecentSales(10);
    expect(recent.map((s) => s.tokenId)).toEqual(['1']);
    expect(recent[0]?.price).toBe(80);
    const category = await source.listCategorySales('digits-1');
    expect(category).toHaveLength(1);
    const metrics = await source.getCategoryMetrics('digits-1');
    expect(metrics?.lastSalePrice).toBe(80);
    expect(metrics?.highestSale?.tokenId).toBe('1');
  });

  it('does not use COUNT of market-state rows as collection supply', async () => {
    const mem = new MemoryMarketRepository();
    await seedToken(mem, 1, 'LISTED', 10, ['digits-1']);
    const source = new SqlMarketSource(new MemoryMarketReadRepository(mem));
    const snapshot = await source.getCollectionSnapshot();
    expect(snapshot.totalSupply).toBe(BUTTON_PRESSER_COLLECTION.officialExistingSupply);
    expect(snapshot.listedCount).toBe(1);
    expect(snapshot.listedCount).not.toBe(snapshot.totalSupply);
  });
});
