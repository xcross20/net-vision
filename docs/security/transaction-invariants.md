# Transaction Invariants

Status: Mandatory. Any change that weakens an invariant must be blocked at code review.

## 1. Net Vision is non-custodial

- Net Vision never requests a seed phrase.
- Net Vision never requests or stores a raw private key.
- Net Vision never asks the user to paste a private key into a form or environment variable.
- Net Vision never signs a user transaction on its own servers.
- Net Vision never grants broad token or NFT approvals on the user's behalf without an explicit, separated step.

## 2. The OpenSea API key is server-only

- `OPENSEA_API_KEY` lives only in server-side secret stores.
- The key never carries a `NEXT_PUBLIC_` prefix.
- The key is never written to client bundles, browser storage, public environment variables, analytics payloads, or error messages.
- A CI test scans generated client bundles for known secret values in non-production test builds.

## 3. Trading fails closed

The transaction policy engine (`packages/transaction-policy`) must reject an executable action if any of the following is not affirmatively validated:

- Chain ID equals the configured Robinhood Chain ID.
- Connected account equals the authenticated wallet and the intended fulfiller or maker.
- The NFT contract equals the allowlisted Button Presser contract.
- The token ID or token set equals the reviewed intent (no injected IDs, no missing IDs).
- The target contract is allowlisted (Seaport or Button Presser).
- Native value is less than or equal to the user's reviewed maximum.
- ERC-20 amount is less than or equal to the user's reviewed maximum.
- The order has not expired.
- The order hash has not changed since the user reviewed the listing.
- The recipient and consideration recipients equal the authenticated wallet.
- No unexpected function selector is present.
- Approvals route only to allowlisted spenders; no unlimited approvals unless the user explicitly chose it.

If any check fails, the UI must show the failure reason and require a fresh confirmation.

## 4. The user is the final signing authority

- The wallet signs transactions. The Net Vision server never holds a signing identity for the user.
- SIWE-style sessions bind the wallet address to a short-lived cookie. Sessions are revoked on disconnect, on chain change, or on explicit sign-out.

## 5. Simulation before signature

For any executable transaction, run `eth_call` (or the provider's supported simulation) against the latest block where feasible. A simulation failure is a blocked transaction.

For typed order signatures (EIP-712) that do not submit a transaction immediately, validate the typed-data domain against the expected Seaport contract and chain.

## 6. Order pinning

The original order hash and price displayed to the user are stored with the trade intent. At preparation time, the order is re-fetched. If the hash changed or the new total exceeds the reviewed cap, the user is shown a changed-price state and must click again.

## 7. Allowlisted contracts

The single source of truth is `packages/chain-config/src/index.ts`. The set is:

- `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` (Button Presser collection).
- `0x0000000000000068F116a894984e2DB1123eB395` (Seaport v1.5).

Any other contract appearing in an executable action causes the transaction policy engine to refuse the action.

## 8. Live trading gate

Live trade preparation is feature-flagged off by default. The flag is `NEXT_PUBLIC_TRADING_ENABLED`. It must only be flipped to `true` after:

- The transaction-policy adversarial suite passes in CI.
- A controlled end-to-end buy is confirmed onchain and reflected in the UI.
- The OpenSea Robinhood Chain identifier is verified against the current official docs.

## 9. Logging

- Never log signed messages, full session tokens, API keys, or unredacted Authorization headers.
- Include a request ID, truncated wallet address, route, upstream status, duration, and error category in every structured log line.
