import { describe, expect, it } from 'vitest';
import { SCHEMA_NATIVE_MARKET_SQL } from './schema-native-market';

describe('native market schema', () => {
  it('creates listings and offer groups idempotently', () => {
    expect(SCHEMA_NATIVE_MARKET_SQL).toContain('CREATE TABLE IF NOT EXISTS native_listings');
    expect(SCHEMA_NATIVE_MARKET_SQL).toContain('CREATE TABLE IF NOT EXISTS native_offer_groups');
    expect(SCHEMA_NATIVE_MARKET_SQL).toContain('CREATE TABLE IF NOT EXISTS native_offers');
    expect(SCHEMA_NATIVE_MARKET_SQL).toContain('id TEXT PRIMARY KEY');
    expect(SCHEMA_NATIVE_MARKET_SQL).toContain('offer_group_id TEXT REFERENCES native_offer_groups(id) ON DELETE SET NULL');
    expect(SCHEMA_NATIVE_MARKET_SQL).toContain("VALUES ('native-market-v1')");
  });
});
