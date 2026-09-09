# Branch Contract

Track ID: P2
Track type: Feature
Branch: `feat/commerce-hardening`
Owner: Commerce agent
Base SHA: `280f73b5fc8b25094cc45dda4bc86a4cd2f4646a`
Base authority epoch: E2
Target epoch compatibility: E2
Worktree: `/Users/immanuellewis/net-vision-wt-commerce`
Spec: `docs/product/parallel-v1/02_COMMERCE_TRANSACTION_SAFETY_SPEC.md`

## Mission

Finish Buy Now / cart / checkout **correctness**, not every marketplace action.

```text
listing → cart snapshot → checkout review → fresh revalidation
→ drift warning → policy validation → simulation → signature
→ receipt → reconciliation
```

Keep Make Offer, Accept Offer, native listing, sweep behind gates until individually hardened.

## Scope IN

- cart domain and order snapshots
- checkout state machine
- transaction review matching decoded calldata
- `packages/transaction-policy` tests and required policy additions
- receipt vs submitted distinction

## Scope OUT

- ungated offers / sweep / native listing
- SQL market authority
- Gear commerce (Gear stays read-only)
- visual marketplace rebuild

## Authority touched

Transaction policy (this track is the owner).

## Authorities consumed

- SQL LISTED facts for revalidation (via MarketSource)
- chain-config Button collection + policy targets

## Allowed paths

- cart / checkout domain modules
- `apps/web/app` commerce routes already present
- `packages/transaction-policy`
- `apps/web/app/api/trade/**` hardening
- commerce tests / e2e (`tools/cart-e2e.mjs` extensions)

## Shared paths requiring coordination

- token detail “add to cart” UI — coordinate with Launch QA / Fletcher
- `apps/web/lib/market/types.ts` additive only

## Forbidden paths

Frozen E2 SQL/worker list. Portfolio identity rewrite. Gear adapter. Intelligence.

## Proposed contract changes

None to market read authority. Cart item identity must include `collectionId`.

## Dependencies

Rebase onto staging after Portfolio merge.

## Merge barrier

Closed until P1 staging PASS. Real-money path: BLOCK on any decode/policy mismatch.

## Required tests

- review matches decoded calldata (token, price, payment token, recipient, chain, target)
- drift warning when listing changes between snapshot and submit
- receipt failed ≠ cart item removed
- hash-only ≠ confirmed

## Required failure simulations

- listing cancelled after add-to-cart
- price change
- simulation failure
- policy reject

## Observability

Log revalidation outcome, policy decision, receipt status. No secrets or calldata dumps of private keys.

## Rollback

Revert commerce PR. Trading flags stay off if unsafe.

## Evidence threshold

Unit + policy tests red-then-green; cart E2E against staging or fixture. Manual review of one Buy Now path.

## Exit criteria

Buy Now sequential checkout is correct and gated features remain gated.

## Contract violation rule

If implementation requires a forbidden path or unowned authority change, STOP and escalate before modifying it.
