/**
 * Canonical Button Presser market universe for A4 SQL reads.
 *
 * Physical tables may contain discovery-envelope rows (token_id 62094
 * and 62095). Supply, coverage, category membership, and listed counts
 * join collections.official_supply and never use COUNT(token_market_state).
 *
 * tokens.exists is metadata observation, not supply membership.
 */
import {
  BUTTON_PRESSER_COLLECTION,
  isOfficialExistingTokenId,
} from '@net-vision/chain-config';

export { isOfficialExistingTokenId };

/** SQL fragment: alias `t` is tokens, alias `c` is collections. */
export const CANONICAL_EXISTING_TOKEN_SQL = `t.token_id >= 1 AND t.token_id <= c.official_supply`;

export const DISCOVERY_ENVELOPE_PHANTOM_IDS = [62094, 62095] as const;

export function discoveryEnvelopePhantomCount(): number {
  return BUTTON_PRESSER_COLLECTION.maxTokenId - BUTTON_PRESSER_COLLECTION.officialExistingSupply;
}
