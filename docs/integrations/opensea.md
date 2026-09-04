# OpenSea Integration Notes

Status: Read-only endpoints verified at the time of v1.1 implementation. Write endpoints are gated behind the transaction-policy adversarial suite.

## Endpoints in scope (read)

| Use case | OpenSea v2 endpoint |
| --- | --- |
| Collection listings | `GET /api/v2/listings/collection/{slug}/all` |
| Best listing for an NFT | `GET /api/v2/listings/collection/{slug}/nfts/{identifier}/best` |
| Listing fulfillment data | `POST /api/v2/listings/fulfillment_data` |
| Listing creation actions | `POST /api/v2/listings/actions` |
| Create a listing | `POST /api/v2/orders/{chain}/{protocol}/listings` |
| Offer fulfillment data | `POST /api/v2/offers/fulfillment_data` |
| Sweep | `POST /api/v2/listings/sweep` |
| Collection and NFT events | OpenSea Events API v2 |
| Transaction receipt (where applicable) | `POST /api/v2/transactions/receipt` |

Deprecated generic listing endpoints are not used.

## Endpoints gated behind the safety suite (write)

Anything that produces an executable action (`fulfillment_data`, `listing_actions`, `sweep`) goes through `validateTradeAction` in `@net-vision/transaction-policy` before any wallet prompt.

## Chain identifier

The OpenSea `chain` parameter is `Robinhood`. The numeric chain ID is configured in `@net-vision/chain-config` and must be cross-checked against the current official Robinhood Chain identifier before any live trade is enabled. If it changes, update `ROBINHOOD_CHAIN.id` and bump `CONFIG_VERSION`.

## API resilience

- Connect and read timeouts default to 8 seconds.
- Only idempotent reads are retried on transient `429` or `5xx` responses with jittered exponential backoff (max 3 attempts).
- Write and fulfillment-prep calls are not blindly retried; semantic ambiguity is treated as a failure.
- Public reads are cached at the route layer. Cursors are persisted only after successful page processing.

## Response validation

- Every response is parsed with a Zod schema.
- Unknown fields are tolerated so upstream additions do not break us.
- Missing required security-sensitive fields cause a hard failure.
- The OpenSea API key is redacted from logs and never appears in error messages.

## Auth

- `X-API-KEY` header on every request.
- Key is loaded from server-side secret manager only.
- The Next.js web app calls Net Vision API routes, never OpenSea directly.
- A CI test scans generated client bundles for the configured key value.

## What is still TODO before live

- Confirm Robinhood Chain identifier and Seaport deployment on Robinhood Chain with the current official OpenSea docs.
- Capture sanitized fixtures for fulfillment data, listing actions, sweep, and error responses.
- Add contract tests that pin the response shape per endpoint.
- Add a runbook for OpenSea outages (see `docs/security/transaction-invariants.md` and the spec).
