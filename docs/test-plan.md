# Test Plan: MVP Definition of Done Mapping

This plan maps every gate in the spec's Definition of Done to the automated or controlled manual verification we run.

## Gate: Data completeness

- **Verification:** `npm test --workspace=@net-vision/taxonomy` must pass with all fixtures green. The classifier must produce the documented traits for every fixture in section 9.4 of the spec.
- **Status:** Passing for the seeded supply slice. Production indexer coverage is required before flipping the trading flag.

## Gate: Floor correctness

- **Verification:** Manual reconciliation of at least 10 virtual collections against active listing data.
- **Status:** Read-only slice uses a deterministic seed. Live reconciliation is a controlled runbook step before flipping the trading flag.

## Gate: Wallet safety

- **Verification:** `npm test --workspace=@net-vision/transaction-policy` runs the adversarial suite (15 cases today, growing). The suite covers wrong chain, wrong contract, unexpected token ID, price drift, unknown recipient, unknown target, expired order, unsupported action, and unallowlisted approval spender.
- **Status:** Passing in the read-only slice.

## Gate: Buy

- **Verification:** A controlled end-to-end purchase against a fixture harness.
- **Status:** Pending. Gated behind the safety suite and live OpenSea endpoint validation.

## Gate: List

- **Verification:** A controlled listing is created and visible via OpenSea and the Net Vision orderbook.
- **Status:** Pending. State machine spec in `docs/marketplaces/cross-listing-state-machine.md`.

## Gate: Sweep

- **Verification:** A fixture-driven sweep of three tokens exercises the exact-basket guard.
- **Status:** Pending. The basket guard (`validateSweepBasket`) is implemented and tested today.

## Gate: Accessibility

- **Verification:** Keyboard navigation and major WCAG AA checks.
- **Status:** Focus styles use the primary green token. Color is paired with mono numerics. Full audit before flipping the trading flag.

## Gate: Mobile

- **Verification:** Critical browse and transaction review flows at 375px width.
- **Status:** Mobile-first token detail above the fold shipped in the read-only slice.

## Gate: Operations

- **Verification:** Runbooks exist for OpenSea outage, RPC outage, stale index, API key rotation, and rollback.
- **Status:** Specified in the v1.1 document and `docs/integrations/opensea.md`. Operational implementation in PR 12.

## CI gates that must stay green

- `npm test` across all workspaces.
- `npm run build` for the web app.
- A bundle scan that fails if the OpenSea API key value appears in client output.
