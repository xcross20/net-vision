# Net Vision Native Orderbook

Status: Specified. Implementation pending. No live writes until the transaction-policy adversarial suite passes.

## Goal

Net Vision operates a native Seaport orderbook for Button Presser with **0% Net Vision marketplace fee**. Collectors can list and buy through Net Vision without paying a marketplace fee on top of the underlying Seaport protocol fee.

## Why a native orderbook alongside OpenSea

- **Zero-fee positioning.** The Net Vision marketplace fee is zero. OpenSea charges its own fee on its listings. Collectors can choose where to list.
- **Default destination.** The seller flow defaults to Net Vision and offers OpenSea as an optional second destination. This is the opposite of an OpenSea clone that pipes everything through OpenSea.
- **Aggregator coverage.** The Net Vision orderbook and OpenSea orders are merged into a unified listing row with a marketplace source badge.

## Architecture sketch

- Net Vision uses the Seaport protocol directly. Orders are signed by users via EIP-712 typed data and broadcast to the Seaport contract.
- Net Vision indexes its own orderbook by watching Seaport events on Robinhood Chain.
- The indexer mirrors the same shape used for OpenSea aggregation (see `opensea-aggregation.md`) so the unified listing row is identical.
- Storage: a `market_orders` table with `marketplace` discriminator (`net-vision` vs `opensea`).

## Constraints

- Net Vision never holds a server-side signing key. Orders are signed by the user's wallet.
- Net Vision never modifies order payloads after the user reviews them.
- Net Vision never accepts an order whose target contract is not in the allowlist.

## Open before live

- Seaport deployment on Robinhood Chain must be verified against the current official docs.
- A local Seaport fixture harness must exist for tests.
- A test plan mapping every MVP Definition of Done gate must pass before the orderbook write path is exposed.
