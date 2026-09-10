/**
 * Postgres persistence for canonical metadata. Idempotent upserts.
 * Image fetch failure must not erase a previously VERIFIED row.
 */
import { createHash } from 'node:crypto';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import { getPool } from './pg';
import {
  CANONICAL_COLLECTION_ID,
  CANONICAL_METADATA_SOURCE,
  canonicalMediaPath,
  officialMaterial,
  officialStamping,
  officialSupply,
  type CanonicalMetadataStatus,
  type CanonicalTokenMetadata,
  type ParsedOnChainMetadata,
} from './canonical-metadata';

export type CanonicalCoverage = {
  officialSupply: number;
  verified: number;
  missing: number;
  invalid: number;
  retry: number;
  identityBlock: number;
  unknown: number;
  imagesCached: number;
  lastSuccessAt: string | null;
};

function sha256Hex(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export async function upsertCanonicalVerified(input: {
  tokenId: number;
  parsed: ParsedOnChainMetadata;
  image: { contentType: string; body: Buffer } | null;
  metadataUriKind: string;
}): Promise<CanonicalTokenMetadata> {
  const db = getPool();
  if (!db) throw new Error('canonical metadata requires DATABASE_URL');
  const tokenId = String(input.tokenId);
  const now = new Date().toISOString();
  const hash = sha256Hex(input.parsed.rawJson);
  const imageUrl = input.image ? canonicalMediaPath(tokenId) : null;
  const row = {
    collection_id: CANONICAL_COLLECTION_ID,
    token_id: input.tokenId,
    name: input.parsed.name,
    description: input.parsed.description,
    image_url: imageUrl,
    animation_url: input.parsed.animationUrl,
    metadata_uri: input.metadataUriKind,
    attributes: JSON.stringify(input.parsed.attributes),
    material: officialMaterial(input.parsed),
    button_number: input.tokenId,
    stamping: officialStamping(input.parsed),
    metadata_source: CANONICAL_METADATA_SOURCE,
    metadata_source_uri: `tokenURI(${input.tokenId})`,
    metadata_hash: hash,
    metadata_status: 'VERIFIED',
    identity_ok: true,
    identity_block_reason: null,
    verified_at: now,
    fetched_at: now,
    source_version: 'onchain-tokenuri-v1',
  };
  await db.query(
    `INSERT INTO token_canonical_metadata (
       collection_id, token_id, name, description, image_url, animation_url, metadata_uri,
       attributes, material, button_number, stamping, metadata_source, metadata_source_uri,
       metadata_hash, metadata_status, identity_ok, identity_block_reason, verified_at,
       fetched_at, source_version
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
     )
     ON CONFLICT (collection_id, token_id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       image_url = COALESCE(EXCLUDED.image_url, token_canonical_metadata.image_url),
       animation_url = EXCLUDED.animation_url,
       metadata_uri = EXCLUDED.metadata_uri,
       attributes = EXCLUDED.attributes,
       material = EXCLUDED.material,
       button_number = EXCLUDED.button_number,
       stamping = EXCLUDED.stamping,
       metadata_source = EXCLUDED.metadata_source,
       metadata_source_uri = EXCLUDED.metadata_source_uri,
       metadata_hash = EXCLUDED.metadata_hash,
       metadata_status = EXCLUDED.metadata_status,
       identity_ok = EXCLUDED.identity_ok,
       identity_block_reason = NULL,
       verified_at = EXCLUDED.verified_at,
       fetched_at = EXCLUDED.fetched_at,
       source_version = EXCLUDED.source_version`,
    [
      row.collection_id,
      row.token_id,
      row.name,
      row.description,
      row.image_url,
      row.animation_url,
      row.metadata_uri,
      row.attributes,
      row.material,
      row.button_number,
      row.stamping,
      row.metadata_source,
      row.metadata_source_uri,
      row.metadata_hash,
      row.metadata_status,
      row.identity_ok,
      row.identity_block_reason,
      row.verified_at,
      row.fetched_at,
      row.source_version,
    ],
  );
  if (input.image) {
    const contentHash = sha256Hex(input.image.body);
    await db.query(
      `INSERT INTO token_media (
         collection_id, token_id, content_type, body, source_uri_kind, content_hash, fetched_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (collection_id, token_id) DO UPDATE SET
         content_type = EXCLUDED.content_type,
         body = EXCLUDED.body,
         source_uri_kind = EXCLUDED.source_uri_kind,
         content_hash = EXCLUDED.content_hash,
         fetched_at = EXCLUDED.fetched_at`,
      [
        CANONICAL_COLLECTION_ID,
        input.tokenId,
        input.image.contentType,
        input.image.body,
        'onchain-data-svg',
        contentHash,
        now,
      ],
    );
  }
  await db.query(
    `INSERT INTO tokens (token_id, display_number, "exists", name, image_url, metadata_json, metadata_verified_at, last_seen_at)
     VALUES ($1,$2,TRUE,$3,$4,$5,$6,NOW())
     ON CONFLICT (token_id) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, tokens.name),
       image_url = COALESCE(EXCLUDED.image_url, tokens.image_url),
       metadata_json = EXCLUDED.metadata_json,
       metadata_verified_at = EXCLUDED.metadata_verified_at,
       last_seen_at = NOW()`,
    [
      input.tokenId,
      tokenId,
      input.parsed.name,
      imageUrl,
      JSON.stringify({
        name: input.parsed.name,
        description: input.parsed.description,
        attributes: input.parsed.attributes,
        traits: input.parsed.attributes.map((a) => ({ trait_type: a.traitType, value: a.value })),
      }),
      now,
    ],
  );
  return {
    collectionId: CANONICAL_COLLECTION_ID,
    tokenId,
    name: input.parsed.name,
    description: input.parsed.description,
    imageUrl,
    animationUrl: input.parsed.animationUrl,
    metadataUri: input.metadataUriKind,
    attributes: input.parsed.attributes,
    material: officialMaterial(input.parsed),
    buttonNumber: input.tokenId,
    stamping: officialStamping(input.parsed),
    metadataSource: CANONICAL_METADATA_SOURCE,
    metadataSourceUri: `tokenURI(${input.tokenId})`,
    metadataHash: hash,
    metadataStatus: 'VERIFIED',
    identityOk: true,
    identityBlockReason: null,
    verifiedAt: now,
    fetchedAt: now,
    sourceVersion: 'onchain-tokenuri-v1',
  };
}

export async function markCanonicalFailure(input: {
  tokenId: number;
  status: Exclude<CanonicalMetadataStatus, 'VERIFIED' | 'UNKNOWN' | 'FETCHING'>;
  reason: string;
  attempt: number;
}): Promise<void> {
  const db = getPool();
  if (!db) throw new Error('canonical metadata requires DATABASE_URL');
  await db.query(
    `INSERT INTO token_canonical_metadata (
       collection_id, token_id, attributes, metadata_source, metadata_status,
       identity_ok, identity_block_reason, fetched_at
     ) VALUES ($1,$2,'[]'::jsonb,$3,$4,$5,$6,NOW())
     ON CONFLICT (collection_id, token_id) DO UPDATE SET
       metadata_status = CASE
         WHEN token_canonical_metadata.metadata_status = 'VERIFIED' THEN token_canonical_metadata.metadata_status
         ELSE EXCLUDED.metadata_status
       END,
       identity_block_reason = CASE
         WHEN token_canonical_metadata.metadata_status = 'VERIFIED' THEN token_canonical_metadata.identity_block_reason
         ELSE EXCLUDED.identity_block_reason
       END,
       fetched_at = NOW()`,
    [
      CANONICAL_COLLECTION_ID,
      input.tokenId,
      CANONICAL_METADATA_SOURCE,
      input.status,
      input.status !== 'IDENTITY_BLOCK',
      input.reason,
    ],
  );
  await db.query(
    `INSERT INTO metadata_fetch_failures (collection_id, token_id, attempt, reason)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (collection_id, token_id, attempt) DO UPDATE SET reason = EXCLUDED.reason, at = NOW()`,
    [CANONICAL_COLLECTION_ID, input.tokenId, input.attempt, input.reason],
  );
}

export async function loadCanonicalMedia(
  tokenId: number,
): Promise<{ contentType: string; body: Buffer } | null> {
  const db = getPool();
  if (!db) return null;
  const result = await db.query<{ content_type: string; body: Buffer }>(
    `SELECT content_type, body FROM token_media WHERE collection_id = $1 AND token_id = $2`,
    [CANONICAL_COLLECTION_ID, tokenId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { contentType: row.content_type, body: row.body };
}

export async function isCanonicalVerified(tokenId: number): Promise<boolean> {
  const db = getPool();
  if (!db) return false;
  const result = await db.query<{ ok: number }>(
    `SELECT 1 AS ok FROM token_canonical_metadata
      WHERE collection_id = $1 AND token_id = $2 AND metadata_status = 'VERIFIED'`,
    [CANONICAL_COLLECTION_ID, tokenId],
  );
  return result.rows.length > 0;
}

export async function readCanonicalCoverage(): Promise<CanonicalCoverage | null> {
  const db = getPool();
  if (!db) return null;
  const statuses = await db.query<{ metadata_status: string; n: string }>(
    `SELECT metadata_status, COUNT(*)::text AS n
       FROM token_canonical_metadata
      WHERE collection_id = $1 AND token_id BETWEEN 1 AND $2
      GROUP BY metadata_status`,
    [CANONICAL_COLLECTION_ID, officialSupply()],
  );
  const counts: Record<string, number> = {};
  for (const row of statuses.rows) counts[row.metadata_status] = Number(row.n);
  const verified = counts.VERIFIED ?? 0;
  const missing = counts.MISSING ?? 0;
  const invalid = counts.INVALID ?? 0;
  const retry = counts.RETRY ?? 0;
  const identityBlock = counts.IDENTITY_BLOCK ?? 0;
  const images = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM token_media
      WHERE collection_id = $1 AND token_id BETWEEN 1 AND $2`,
    [CANONICAL_COLLECTION_ID, officialSupply()],
  );
  const last = await db.query<{ last_success_at: Date | null }>(
    `SELECT MAX(last_success_at) AS last_success_at FROM metadata_backfill_checkpoint
      WHERE collection_id = $1`,
    [CANONICAL_COLLECTION_ID],
  );
  return {
    officialSupply: officialSupply(),
    verified,
    missing,
    invalid,
    retry,
    identityBlock,
    unknown: Math.max(0, officialSupply() - verified - missing - invalid - retry - identityBlock),
    imagesCached: Number(images.rows[0]?.n ?? 0),
    lastSuccessAt: last.rows[0]?.last_success_at?.toISOString() ?? null,
  };
}

export async function loadCheckpoint(shard: number): Promise<{ lastTokenId: number; shardCount: number }> {
  const db = getPool();
  if (!db) return { lastTokenId: 0, shardCount: 1 };
  const result = await db.query<{ last_token_id: number; shard_count: number }>(
    `SELECT last_token_id, shard_count FROM metadata_backfill_checkpoint
      WHERE collection_id = $1 AND shard = $2`,
    [CANONICAL_COLLECTION_ID, shard],
  );
  const row = result.rows[0];
  return { lastTokenId: row?.last_token_id ?? 0, shardCount: row?.shard_count ?? 1 };
}

export async function saveCheckpoint(input: {
  shard: number;
  shardCount: number;
  lastTokenId: number;
  processedDelta?: number;
  verifiedDelta?: number;
  missingDelta?: number;
  invalidDelta?: number;
  retryDelta?: number;
  identityBlockDelta?: number;
  lastError?: string | null;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `INSERT INTO metadata_backfill_checkpoint (
       collection_id, shard, shard_count, last_token_id, processed, verified, missing, invalid, retry, identity_block, last_error, last_success_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
     ON CONFLICT (collection_id, shard) DO UPDATE SET
       shard_count = EXCLUDED.shard_count,
       last_token_id = GREATEST(metadata_backfill_checkpoint.last_token_id, EXCLUDED.last_token_id),
       processed = metadata_backfill_checkpoint.processed + EXCLUDED.processed,
       verified = metadata_backfill_checkpoint.verified + EXCLUDED.verified,
       missing = metadata_backfill_checkpoint.missing + EXCLUDED.missing,
       invalid = metadata_backfill_checkpoint.invalid + EXCLUDED.invalid,
       retry = metadata_backfill_checkpoint.retry + EXCLUDED.retry,
       identity_block = metadata_backfill_checkpoint.identity_block + EXCLUDED.identity_block,
       last_error = EXCLUDED.last_error,
       last_success_at = CASE WHEN EXCLUDED.last_error IS NULL THEN NOW() ELSE metadata_backfill_checkpoint.last_success_at END,
       updated_at = NOW()`,
    [
      CANONICAL_COLLECTION_ID,
      input.shard,
      input.shardCount,
      input.lastTokenId,
      input.processedDelta ?? 0,
      input.verifiedDelta ?? 0,
      input.missingDelta ?? 0,
      input.invalidDelta ?? 0,
      input.retryDelta ?? 0,
      input.identityBlockDelta ?? 0,
      input.lastError ?? null,
    ],
  );
}

export function nextOfficialTokenId(lastTokenId: number, shard: number, shardCount: number): number | null {
  const max = BUTTON_PRESSER_COLLECTION.officialExistingSupply;
  for (let id = lastTokenId + 1; id <= max; id += 1) {
    if (id % shardCount === shard) return id;
  }
  return null;
}
