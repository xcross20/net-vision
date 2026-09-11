/**
 * Canonical Button Presser metadata from on-chain tokenURI().
 * Official universe is 1..officialExistingSupply (62093). Phantoms
 * 62094/62095 are never canonical coverage rows.
 *
 * Official Plate/Presser/Stamping stay labeled metadata.
 * Derived Net Vision facets stay in token_facets with source=derived.
 */
import { BUTTON_PRESSER_COLLECTION, isOfficialExistingTokenId } from '@net-vision/chain-config';

export const CANONICAL_COLLECTION_ID = 'button-presser';
export const CANONICAL_METADATA_SOURCE = 'contract-token-uri' as const;
export const TOKEN_URI_SELECTOR = '0xc87b56dd';

export type CanonicalMetadataStatus =
  | 'UNKNOWN'
  | 'FETCHING'
  | 'VERIFIED'
  | 'MISSING'
  | 'INVALID'
  | 'RETRY'
  | 'IDENTITY_BLOCK';

export type OfficialAttribute = {
  traitType: string;
  value: string | number;
};

export type CanonicalTokenMetadata = {
  collectionId: typeof CANONICAL_COLLECTION_ID;
  tokenId: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  metadataUri: string | null;
  attributes: OfficialAttribute[];
  material: string | null;
  buttonNumber: number | null;
  stamping: string | null;
  metadataSource: typeof CANONICAL_METADATA_SOURCE;
  metadataSourceUri: string | null;
  metadataHash: string | null;
  metadataStatus: CanonicalMetadataStatus;
  identityOk: boolean;
  identityBlockReason: string | null;
  verifiedAt: string | null;
  fetchedAt: string;
  sourceVersion: string | null;
};

export type ParsedOnChainMetadata = {
  name: string | null;
  description: string | null;
  imageDataUri: string | null;
  animationUrl: string | null;
  attributes: OfficialAttribute[];
  rawJson: string;
};

export type IdentityVerdict =
  | { ok: true; buttonNumber: number }
  | { ok: false; reason: string };

export function officialSupply(): number {
  return BUTTON_PRESSER_COLLECTION.officialExistingSupply;
}

export function isCanonicalTokenId(tokenId: number): boolean {
  return isOfficialExistingTokenId(tokenId);
}

export function canonicalMediaPath(tokenId: string): string {
  return `/api/media/canonical/${tokenId}`;
}

export function tokenUriCalldata(tokenId: number): `0x${string}` {
  if (!Number.isInteger(tokenId) || tokenId < 0) {
    throw new Error(`tokenUriCalldata: invalid tokenId ${tokenId}`);
  }
  return `${TOKEN_URI_SELECTOR}${tokenId.toString(16).padStart(64, '0')}` as `0x${string}`;
}

export function decodeAbiString(data: string): string {
  if (!data || data === '0x') throw new Error('empty eth_call result');
  const hex = data.startsWith('0x') ? data.slice(2) : data;
  const raw = Buffer.from(hex, 'hex');
  if (raw.length < 64) throw new Error('eth_call string too short');
  const offset = Number(raw.readBigUInt64BE(24));
  const length = Number(raw.readBigUInt64BE(offset + 24));
  return raw.subarray(offset + 32, offset + 32 + length).toString('utf8');
}

export function parseOnChainTokenUri(uri: string): ParsedOnChainMetadata {
  if (!uri.startsWith('data:application/json;base64,')) {
    throw new Error('unsupported tokenURI scheme');
  }
  const json = Buffer.from(uri.slice('data:application/json;base64,'.length), 'base64').toString('utf8');
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const attributes: OfficialAttribute[] = [];
  if (Array.isArray(parsed.attributes)) {
    for (const row of parsed.attributes) {
      if (!row || typeof row !== 'object') continue;
      const traitType = (row as { trait_type?: unknown }).trait_type;
      const value = (row as { value?: unknown }).value;
      if (typeof traitType !== 'string') continue;
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      attributes.push({ traitType, value });
    }
  }
  const image = typeof parsed.image === 'string' ? parsed.image : null;
  return {
    name: typeof parsed.name === 'string' ? parsed.name : null,
    description: typeof parsed.description === 'string' ? parsed.description : null,
    imageDataUri: image,
    animationUrl: typeof parsed.animation_url === 'string' ? parsed.animation_url : null,
    attributes,
    rawJson: json,
  };
}

export function verifyMetadataIdentity(tokenId: string, parsed: ParsedOnChainMetadata): IdentityVerdict {
  const n = Number(tokenId);
  if (!isCanonicalTokenId(n)) {
    return { ok: false, reason: `token ${tokenId} is outside official universe 1..${officialSupply()}` };
  }
  const expectedName = `Button Presser #${tokenId}`;
  if (parsed.name !== expectedName) {
    return { ok: false, reason: `name mismatch: expected ${expectedName}, got ${parsed.name}` };
  }
  const presser = parsed.attributes.find((a) => a.traitType.toLowerCase() === 'presser');
  if (presser == null) {
    return { ok: false, reason: 'missing Presser trait' };
  }
  if (Number(presser.value) !== n) {
    return { ok: false, reason: `Presser trait ${presser.value} != tokenId ${tokenId}` };
  }
  return { ok: true, buttonNumber: n };
}

export function officialMaterial(parsed: ParsedOnChainMetadata): string | null {
  const plate = parsed.attributes.find((a) => a.traitType.toLowerCase() === 'plate');
  return plate ? String(plate.value) : null;
}

export function officialStamping(parsed: ParsedOnChainMetadata): string | null {
  const row = parsed.attributes.find((a) => a.traitType.toLowerCase() === 'stamping');
  return row ? String(row.value) : null;
}

export function decodeSvgFromDataUri(image: string | null): { contentType: string; body: Buffer } | null {
  if (!image) return null;
  const match = /^data:(image\/svg\+xml);base64,(.+)$/.exec(image);
  if (!match) return null;
  return { contentType: match[1], body: Buffer.from(match[2], 'base64') };
}

export function coverageTotalsMustSum(input: {
  verified: number;
  missing: number;
  invalid: number;
  retry: number;
  identityBlock: number;
  unknown: number;
}): boolean {
  const sum =
    input.verified +
    input.missing +
    input.invalid +
    input.retry +
    input.identityBlock +
    input.unknown;
  return sum === officialSupply();
}

/**
 * Pure helper: how much of the whole collection (official supply)
 * is covered by the supplied count. Returns a percent rounded to
 * two decimals, exactly as the operator-facing JSON surfaces it.
 *
 * The denominator is `officialSupply()` (62,093 for Button Presser)
 * — NOT `imagesCached + missingDelta`, NOT `verified + missing`, NOT
 * any in-flight worker cursor. The whole collection is fixed; cache
 * coverage is a strict subset.
 *
 * 0 / supply            → 0%
 * 1 / supply            → 0.00% (rounds down)
 * supply / supply       → 100%
 * supply * 1.5 / supply → 100% (clamped — never report > 100%)
 */
export function cacheCoveragePercent(cachedCount: number): number {
  const supply = officialSupply();
  if (supply <= 0) return 0;
  const ratio = cachedCount / supply;
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * 10000) / 100;
}
