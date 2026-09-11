import { describe, expect, it } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import {
  cacheCoveragePercent,
  canonicalMediaPath,
  coverageTotalsMustSum,
  decodeSvgFromDataUri,
  isCanonicalTokenId,
  officialSupply,
  parseOnChainTokenUri,
  tokenUriCalldata,
  verifyMetadataIdentity,
} from './canonical-metadata';
import { nextOfficialTokenId } from './canonical-metadata-store';

function dataUri(payload: object): string {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}

function officialJson(tokenId: number, extras: Record<string, unknown> = {}) {
  return {
    name: `Button Presser #${tokenId}`,
    description: 'Presser of THE BUTTON.',
    attributes: [
      { trait_type: 'Presser', value: tokenId },
      { trait_type: 'Plate', value: 'Brass' },
      { trait_type: 'Stamping', value: 'Hand struck' },
    ],
    image: 'data:image/svg+xml;base64,PHN2Zy8+',
    ...extras,
  };
}

describe('shard resume cursor', () => {
  it('covers every official id across shards without overlap', () => {
    const shards = 4;
    const seen = new Set<number>();
    for (let shard = 0; shard < shards; shard += 1) {
      let last = 0;
      for (;;) {
        const next = nextOfficialTokenId(last, shard, shards);
        if (next == null) break;
        expect(next % shards).toBe(shard);
        expect(seen.has(next)).toBe(false);
        seen.add(next);
        last = next;
      }
    }
    expect(seen.size).toBe(officialSupply());
    expect(seen.has(62094)).toBe(false);
  });

  it('resumes after last_token_id without restarting from 1', () => {
    expect(nextOfficialTokenId(31422, 0, 1)).toBe(31423);
  });
});

describe('canonical universe', () => {
  it('covers exactly official supply 62093 and excludes discovery phantoms', () => {
    expect(officialSupply()).toBe(62093);
    expect(isCanonicalTokenId(1)).toBe(true);
    expect(isCanonicalTokenId(62093)).toBe(true);
    expect(isCanonicalTokenId(62094)).toBe(false);
    expect(isCanonicalTokenId(62095)).toBe(false);
    expect(BUTTON_PRESSER_COLLECTION.maxTokenId).toBe(62095);
  });

  it('coverage buckets must sum to official supply', () => {
    expect(
      coverageTotalsMustSum({
        verified: 61824,
        missing: 181,
        invalid: 0,
        retry: 88,
        identityBlock: 0,
        unknown: 0,
      }),
    ).toBe(true);
    expect(
      coverageTotalsMustSum({
        verified: 62093,
        missing: 0,
        invalid: 0,
        retry: 0,
        identityBlock: 0,
        unknown: 1,
      }),
    ).toBe(false);
  });
});

describe('cacheCoveragePercent — whole-collection image cache percentage', () => {
  const SUPPLY = officialSupply();
  it('uses official supply (62,093) as the denominator, never anything else', () => {
    expect(SUPPLY).toBe(62093);
  });

  it('returns 0 when nothing is cached', () => {
    expect(cacheCoveragePercent(0)).toBe(0);
  });

  it('returns 0.00% for a single cached token (rounds to two decimals)', () => {
    // 1 / 62093 ≈ 0.00161 % → rounds to 0.00
    expect(cacheCoveragePercent(1)).toBe(0);
  });

  it('matches the documented math for partial coverage', () => {
    // 100 / 62093 ≈ 0.1611% → 0.16
    expect(cacheCoveragePercent(100)).toBeCloseTo(0.16, 2);
    // 1000 / 62093 ≈ 1.6105% → 1.61
    expect(cacheCoveragePercent(1000)).toBeCloseTo(1.61, 2);
    // 10000 / 62093 ≈ 16.1049% → 16.10
    expect(cacheCoveragePercent(10_000)).toBeCloseTo(16.1, 2);
  });

  it('reports 100% when the entire collection is cached', () => {
    expect(cacheCoveragePercent(SUPPLY)).toBe(100);
  });

  it('clamps negative counts to 0%', () => {
    expect(cacheCoveragePercent(-5)).toBe(0);
  });

  it('clamps values larger than supply to 100%', () => {
    expect(cacheCoveragePercent(SUPPLY * 2)).toBe(100);
  });

  it('half-collection is exactly 50.00%', () => {
    expect(cacheCoveragePercent(SUPPLY / 2)).toBe(50);
  });

  it('rounds to two decimal places (not three, not four)', () => {
    // 1234 / 62093 = 0.0198722… → 1.99%
    expect(cacheCoveragePercent(1234)).toBe(1.99);
    // 9876 / 62093 = 0.1590552… → 15.91%
    expect(cacheCoveragePercent(9876)).toBe(15.91);
  });
});

describe('tokenURI decode + identity', () => {
  it('accepts matching name and Presser trait', () => {
    const parsed = parseOnChainTokenUri(dataUri(officialJson(43)));
    const id = verifyMetadataIdentity('43', parsed);
    expect(id).toEqual({ ok: true, buttonNumber: 43 });
    expect(parsed.name).toBe('Button Presser #43');
  });

  it('IDENTITY_BLOCK when Presser trait diverges — does not silently normalize', () => {
    const parsed = parseOnChainTokenUri(
      dataUri(officialJson(43, { attributes: [{ trait_type: 'Presser', value: 99 }] })),
    );
    const id = verifyMetadataIdentity('43', parsed);
    expect(id.ok).toBe(false);
    if (id.ok) return;
    expect(id.reason).toMatch(/Presser trait 99 != tokenId 43/);
  });

  it('rejects phantom 62095 even if contract returns metadata', () => {
    const parsed = parseOnChainTokenUri(dataUri(officialJson(62095)));
    const id = verifyMetadataIdentity('62095', parsed);
    expect(id.ok).toBe(false);
    if (id.ok) return;
    expect(id.reason).toMatch(/outside official universe/);
  });

  it('decodes on-chain SVG and does not invent collection art', () => {
    const parsed = parseOnChainTokenUri(dataUri(officialJson(1)));
    const svg = decodeSvgFromDataUri(parsed.imageDataUri);
    expect(svg?.contentType).toBe('image/svg+xml');
    expect(svg?.body.toString('utf8')).toContain('<svg');
  });

  it('tokenURI calldata is selector + uint256', () => {
    expect(tokenUriCalldata(20343)).toBe(
      `0xc87b56dd${(20343).toString(16).padStart(64, '0')}`,
    );
  });

  it('canonical media path is Net Vision cache, not OpenSea', () => {
    expect(canonicalMediaPath('20343')).toBe('/api/media/canonical/20343');
  });
});
