# Button number identity

**Verdict: HOLD.** Canonical key is `token_id`.

`token_id == OpenSea nft.identifier == Presser trait value == number in metadata name`.

Taxonomy may continue to `classifyNumber(tokenId)`. A separate `display_number` column is stored equal to `token_id` so a future mint that breaks the invariant can switch the join key without rewriting the schema.

## Probe

- Date: 2026-09-05
- Source: OpenSea `GET /api/v2/chain/robinhood/contract/{address}/nfts/{tokenId}`
- Fixture: `apps/web/fixtures/number-identity.json` (62 samples)

## Coverage

- Token IDs 1–20
- Boundaries: 9/10, 99/100, 999/1000, 9999/10000
- Known examples: 966, 628, 870, 507, 756, 635
- 30 additional ids from a deterministic PRNG across 1..62095

Every present sample matched. No identifier/Presser divergence.

## Example

| field | #966 |
| --- | --- |
| requested tokenId | 966 |
| OpenSea identifier | 966 |
| name | Button Presser #966 |
| Presser trait | 966 |

## Implication

Do not classify on a derived display number unless a later nightly probe fails this fixture.
