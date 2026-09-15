import { describe, expect, it } from 'vitest';
import { BUTTON_PRESSER_COLLECTION } from '@net-vision/chain-config';
import {
  CANONICAL_EXISTING_TOKEN_SQL,
  DISCOVERY_ENVELOPE_PHANTOM_IDS,
  discoveryEnvelopePhantomCount,
  isOfficialExistingTokenId,
} from './canonical-universe';

describe('canonical market universe', () => {
  it('names the two discovery-envelope ids that are not official supply', () => {
    expect(discoveryEnvelopePhantomCount()).toBe(2);
    expect(DISCOVERY_ENVELOPE_PHANTOM_IDS).toEqual([62094, 62095]);
    for (const id of DISCOVERY_ENVELOPE_PHANTOM_IDS) {
      expect(isOfficialExistingTokenId(id)).toBe(false);
      expect(id).toBeGreaterThan(BUTTON_PRESSER_COLLECTION.officialExistingSupply);
      expect(id).toBeLessThanOrEqual(BUTTON_PRESSER_COLLECTION.maxTokenId);
    }
  });

  it('A4 SQL reads must constrain token_id to collections.official_supply, not table COUNT', () => {
    expect(CANONICAL_EXISTING_TOKEN_SQL).toContain('t.token_id <= c.official_supply');
    expect(CANONICAL_EXISTING_TOKEN_SQL).not.toMatch(/COUNT\s*\(\s*token_market_state/i);
  });
});
