# Net Vision product invariants

Encode these as tests and release checks. Source: Operating Manual v1.1.

## Semantic ownership

| Fact | Authority |
| --- | --- |
| `collection.totalSupply` | Plate `officialExistingSupply` (62093) |
| `collection.listedVerified` | Worker index, `LISTED` only |
| `collection.knownAskCount` | LISTED + STALE last-known asks |
| `collection.floor` | Lowest LISTED ask in the catalog |
| `category.listedVerified` | `TokenCatalog.categoryTotals` LISTED |
| `category.floor` | Lowest LISTED ask in the category; null while `syncing` |
| Wallet execution | Decoded calldata + policy, never user-supplied id/price as verification |

## Market data

- A missing upstream value is not the same as zero and not the same as a confident empty catalog.
- Unknown listing state is never presented as unlisted.
- STALE is never silently presented as freshly verified LISTED.
- For one snapshot revision, the Categories directory, category detail, category API, listing API total, and category tab count agree semantically.
- Collection listed count cannot exceed collection supply.
- `marketStatus = live` requires coverage ≥ 0.95.
- A category member partition must reconcile to its expected supply or explicitly report incomplete membership.
- Material membership comes only from official Plate metadata, never token-ID ranges.
- Token identity is `(collection_id, token_id)`. A token id is not globally unique across collections.
- `token_facets` is canonical membership; `token_categories` is a derived lookup and must not diverge.

## Impossible states

- `totalSupply = 0` ∧ (`listedCount > 0` ∨ owners/volume presented as facts)
- UI Live ∧ (`marketStatus = syncing` ∨ coverage < 0.95)
- Cart confirmed ∧ receipt failed

## Temporal consistency

Compare surfaces only at the same `snapshotRevision` (or a named freshness window).

## Live read path

- A worker-written state change becomes visible to a long-lived web process without process restart.
- A browser can observe live market changes without losing filters, selection, or cart state.

## Wallet and commerce

- A transaction hash means submitted, not confirmed.
- A cart item is removed only after a successful receipt.
- Every Buy review must match decoded executable calldata, payment token, maximum spend, collection, token, recipient, chain, and target.
- Sweep remains disabled until listing completeness and cart execution gates pass.

## Failure and recovery

- Optional upstream failures must degrade a section, not fabricate data or unnecessarily take down the entire page.
- Stream miss / disconnect, web-vs-worker lag, and 429 each have a named detection, recovery, and SLA.
