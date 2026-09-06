import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';
import { LISTING_STATES } from '../market/listing-state';
import {
  BUTTON_PRESSER_COLLECTION_ID,
  FACET_OWNERSHIP,
  HELIX_ECOSYSTEM_ID,
  SCHEMA_V2_SQL,
  tokenIdentity,
} from './schema-v2';

const here = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(here, 'schema.sql'), 'utf8');
const pgSource = readFileSync(join(here, 'pg.ts'), 'utf8');

describe('tokenIdentity', () => {
  it('scopes token ids to a collection so Button #68 ≠ Gear #68', () => {
    expect(tokenIdentity('button-presser', 68)).not.toBe(tokenIdentity('netnet-gear', 68));
    expect(tokenIdentity('button-presser', 68)).toBe('button-presser:68');
  });

  it('rejects missing collection or non-integer token id (impossible-state)', () => {
    expect(() => tokenIdentity('', 68)).toThrow(/collectionId/);
    expect(() => tokenIdentity('button-presser', 68.5)).toThrow(/tokenId/);
    expect(() => tokenIdentity('button-presser', -1)).toThrow(/tokenId/);
  });
});

describe('facet ownership', () => {
  it('names token_facets as canonical and token_categories as derived', () => {
    expect(FACET_OWNERSHIP.canonical).toBe('token_facets');
    expect(FACET_OWNERSHIP.derived).toBe('token_categories');
    expect(FACET_OWNERSHIP.canonical).not.toBe(FACET_OWNERSHIP.derived);
  });
});

describe('SCHEMA_V2_SQL (A1)', () => {
  it('seeds Helix + Button Presser from chain-config, not a second supply number', () => {
    expect(SCHEMA_V2_SQL).toContain(`'${HELIX_ECOSYSTEM_ID}'`);
    expect(SCHEMA_V2_SQL).toContain(`'${BUTTON_PRESSER_COLLECTION_ID}'`);
    expect(SCHEMA_V2_SQL).toContain(String(BUTTON_PRESSER_COLLECTION.officialExistingSupply));
    expect(SCHEMA_V2_SQL).toContain(String(ROBINHOOD_CHAIN.id));
    expect(SCHEMA_V2_SQL).toContain(BUTTON_PRESSER_COLLECTION.contractAddress);
    expect(SCHEMA_V2_SQL).toContain(BUTTON_PRESSER_COLLECTION.openseaSlug);
    expect(BUTTON_PRESSER_COLLECTION.officialExistingSupply).toBe(62093);
  });

  it('adds collection_id to every token-scoped table with Button Presser default', () => {
    for (const table of [
      'tokens',
      'token_facets',
      'token_categories',
      'token_market_state',
      'sales',
      'sale_attributions',
      'floor_history',
    ]) {
      expect(SCHEMA_V2_SQL).toMatch(
        new RegExp(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS collection_id TEXT NOT NULL DEFAULT '${BUTTON_PRESSER_COLLECTION_ID}'`,
        ),
      );
    }
  });

  it('creates collection-scoped unique indexes without dropping token_id PKs', () => {
    expect(SCHEMA_V2_SQL).toContain('tokens_collection_token_uidx');
    expect(SCHEMA_V2_SQL).toContain('ON tokens (collection_id, token_id)');
    expect(SCHEMA_V2_SQL).toContain('UNIQUE (source, source_event_id)');
    expect(SCHEMA_V2_SQL).not.toMatch(/DROP\s+TABLE/i);
    expect(SCHEMA_V2_SQL).not.toMatch(/DROP\s+CONSTRAINT/i);
    expect(SCHEMA_V2_SQL).not.toMatch(/DROP TABLE IF EXISTS index_blob/i);
  });

  it('does not mention index_blob except in a COMMENT that keeps it as checkpoint', () => {
    const blobMentions = SCHEMA_V2_SQL.match(/index_blob/g) ?? [];
    expect(blobMentions).toEqual(['index_blob']);
    expect(SCHEMA_V2_SQL).toMatch(/COMMENT ON TABLE index_blob/i);
  });

  it('constrains listing_state to the four legal states from LISTING_STATES', () => {
    for (const state of LISTING_STATES) {
      expect(SCHEMA_V2_SQL).toContain(`'${state}'`);
    }
    expect(LISTING_STATES).toEqual(['UNKNOWN', 'LISTED', 'UNLISTED_VERIFIED', 'STALE']);
    expect(SCHEMA_V2_SQL).toContain('token_market_state_listing_state_chk');
  });

  it('declares facet canonical / category derived in SQL comments', () => {
    expect(SCHEMA_V2_SQL).toMatch(/COMMENT ON TABLE token_facets IS/i);
    expect(SCHEMA_V2_SQL).toMatch(/Canonical membership/i);
    expect(SCHEMA_V2_SQL).toMatch(/COMMENT ON TABLE token_categories IS/i);
    expect(SCHEMA_V2_SQL).toMatch(/Derived\/materialized/i);
  });

  it('is idempotent: IF NOT EXISTS / ON CONFLICT / DO $$ guard', () => {
    expect(SCHEMA_V2_SQL).toContain('CREATE TABLE IF NOT EXISTS ecosystems');
    expect(SCHEMA_V2_SQL).toContain('CREATE TABLE IF NOT EXISTS collections');
    expect(SCHEMA_V2_SQL).toContain('CREATE TABLE IF NOT EXISTS market_events');
    expect(SCHEMA_V2_SQL).toContain('ADD COLUMN IF NOT EXISTS');
    expect(SCHEMA_V2_SQL).toContain('ON CONFLICT (id) DO NOTHING');
    expect(SCHEMA_V2_SQL).toContain("conname = 'token_market_state_listing_state_chk'");
  });
});

describe('A1 residual: old token_id PKs stay until A2', () => {
  it('v1 schema.sql still declares token_id PRIMARY KEY (expand, not contract)', () => {
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS tokens\s*\(\s*token_id INTEGER PRIMARY KEY/s);
    expect(schemaSql).toMatch(
      /CREATE TABLE IF NOT EXISTS token_market_state\s*\(\s*token_id INTEGER PRIMARY KEY/s,
    );
  });

  it('pg.ts dual-write still ON CONFLICT (token_id) — PK drop would crash this', () => {
    expect(pgSource).toContain('ON CONFLICT (token_id) DO UPDATE SET');
    expect(pgSource).toContain('normalized: false');
  });

  it('pg.ts ensureSchema applies SCHEMA_V2_SQL after v1', () => {
    expect(pgSource).toContain('SCHEMA_V2_SQL');
    expect(pgSource).toMatch(/await db\.query\(SCHEMA_SQL\)/);
    expect(pgSource).toMatch(/await db\.query\(SCHEMA_V2_SQL\)/);
  });
});
