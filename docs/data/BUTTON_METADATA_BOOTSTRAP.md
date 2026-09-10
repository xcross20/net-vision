# Button Presser metadata bootstrap

**Track:** independent of USDG checkout. Does not change transaction authority.

## Invariant

Metadata state and listing state are independent. A token becoming LISTED must not discover image, Plate, or facets on the event path.

```text
official 1..62093
  → tokenURI() eth_call
  → token_canonical_metadata + token_media
  → token_facets (official Plate + derived number facets)
  → listing events only write token_market_state
```

## Worker

`startCanonicalMetadataBootstrap()` from market-worker boot.

- Universe: `isOfficialExistingTokenId` only
- Resume: `metadata_backfill_checkpoint.last_token_id` per shard
- Shards: `METADATA_BOOTSTRAP_SHARDS` / `METADATA_BOOTSTRAP_SHARD` (`token_id % shards == shard`)
- Concurrency env reserved; first ship is serial batches of 25
- Idempotent upsert; `VERIFIED` is not overwritten by a later RETRY
- Image failure does not erase previously valid metadata JSON
- Disable: `METADATA_BOOTSTRAP_ENABLED=false`

## Media

Verified SVG is stored in `token_media` and served at `/api/media/canonical/{tokenId}`. Missing cache returns an honest **Image pending** SVG (no fabricated Plate).

## Repair

OpenSea metadata walker remains as fallback. If canonical status is already `VERIFIED`, that walker records `found` and does not call OpenSea.

## Health

`GET /api/v1/health/indexer` → `canonicalMetadata` (separate from listing coverage).
