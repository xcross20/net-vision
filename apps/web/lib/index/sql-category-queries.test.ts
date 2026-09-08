import { describe, expect, it } from 'vitest';
import {
  SQL_CATEGORY_LISTED_TOKENS,
  SQL_CATEGORY_MARKET_FACTS,
  SQL_CATEGORY_SALES,
  SQL_COLLECTION_MARKET_FACTS,
  SQL_RECENT_SALES,
  SQL_TOKEN_SALES,
} from './sql-category-queries';
import { CANONICAL_EXISTING_TOKEN_SQL } from './canonical-universe';

describe('A4 SQL category queries', () => {
  it('constrains collection facts to official_supply and never COUNT(token_market_state) as supply', () => {
    expect(SQL_COLLECTION_MARKET_FACTS).toContain('c.official_supply');
    expect(SQL_COLLECTION_MARKET_FACTS).toContain('m.token_id <= c.official_supply');
    expect(SQL_COLLECTION_MARKET_FACTS).not.toMatch(/COUNT\s*\(\s*\*\s*\)\s+AS official_supply/i);
    expect(SQL_COLLECTION_MARKET_FACTS).not.toMatch(/COUNT\s*\(\s*token_market_state/i);
  });

  it('joins token_facets for membership and official_supply for the envelope', () => {
    expect(SQL_CATEGORY_MARKET_FACTS).toContain('token_facets');
    expect(SQL_CATEGORY_MARKET_FACTS).toContain(CANONICAL_EXISTING_TOKEN_SQL);
    expect(SQL_CATEGORY_LISTED_TOKENS).toContain("m.listing_state = 'LISTED'");
    expect(SQL_CATEGORY_LISTED_TOKENS).toContain(CANONICAL_EXISTING_TOKEN_SQL);
  });

  it('constrains sales reads to official_supply', () => {
    expect(SQL_RECENT_SALES).toContain('s.token_id <= c.official_supply');
    expect(SQL_TOKEN_SALES).toContain('s.token_id <= c.official_supply');
    expect(SQL_CATEGORY_SALES).toContain('s.token_id <= c.official_supply');
    expect(SQL_CATEGORY_SALES).toContain('sale_attributions');
  });
});
