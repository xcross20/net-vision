# Wallet, Security, and Trading

Net Vision is designed as a **non-custodial** market interface. The user's wallet remains the final signing authority for any executable blockchain action.

The security model is intentionally stricter than “the marketplace returned a transaction, so ask the user to sign it.” Net Vision validates executable actions against the user's reviewed intent before a wallet prompt is allowed to proceed.

## What Net Vision does not ask for

Net Vision does not request or store:

- a seed phrase;
- a raw private key; or
- a server-side signing key that can act as the user.

The server does not sign user transactions.

A legitimate Net Vision flow should never require a user to paste a seed phrase or private key into the application, a support message, or an environment-variable form.

## Connecting a wallet

Wallet connection lets the application identify the active account, show wallet-specific holdings, and prepare actions for that account. Connection by itself is not permission to transfer assets.

Any executable action still requires the appropriate wallet interaction and must satisfy Net Vision's transaction policy.

## Trading is fail-closed

The production trading path is gated. If the environment is not explicitly configured for live trading, executable preparation should remain unavailable rather than falling back to a less-validated path.

This means documentation should distinguish between:

- browsing listings and market data;
- adding listings to a cart;
- preparing a purchase; and
- actually presenting a wallet with an executable transaction.

The repository contains the commerce flow, but live execution should only be described as Available when the production trading gate and its required safety checks are active.

## What Net Vision validates before execution

For an executable marketplace action, the transaction policy is designed to verify facts such as:

- the expected Robinhood Chain;
- the connected and intended wallet account;
- the allowlisted Button Presser NFT contract;
- the exact token ID or token set the user reviewed;
- the allowlisted execution contract;
- the native or ERC-20 amount against the reviewed maximum;
- order expiration;
- whether the order hash changed after review;
- expected recipients and consideration recipients;
- the called function or typed-data domain; and
- approval targets.

If required security-sensitive information cannot be affirmatively validated, the action should be rejected and the user should be required to review fresh information.

## Order pinning and price changes

A displayed marketplace listing is not assumed to remain unchanged forever.

Net Vision keeps the reviewed order identity and price with the user's trade intent. Before executable preparation, the order is revalidated. If the order changed, disappeared, expired, or became more expensive than the reviewed cap, the previous confirmation is no longer sufficient.

The user should see the changed state and make a new decision.

## Simulation

Where an executable transaction can be simulated against the chain before signature, Net Vision's policy requires a successful simulation. A failed simulation is a blocked transaction, not a warning to click through.

Typed marketplace signatures that do not immediately submit a transaction still require validation of the expected chain and protocol domain.

## Allowlisted contracts

The chain configuration package is the source of truth for contracts that Net Vision may treat as valid in an executable Button Presser flow.

The current allowlisted Button Presser collection is:

`0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2`

The configured OpenSea execution protocol is Seaport v1.5:

`0x0000000000000068F116a894984e2DB1123eB395`

The current configured settlement asset is USDG on Robinhood Chain. Net Vision matches payment assets by chain and contract address, not by token symbol alone.

Any unexpected contract in a transaction is a reason to refuse the action rather than silently expand the allowlist.

## OpenSea API security

The OpenSea API key is server-only. The browser talks to Net Vision routes, not directly to OpenSea with the private key.

Sensitive credentials should not appear in client bundles, browser storage, public environment variables, analytics payloads, or user-facing errors.

## Cart revalidation

The cart is not a promise that every selected listing is still executable. It is a record of user selection plus a listing snapshot.

Before checkout preparation, listings are revalidated so that sold, cancelled, expired, repriced, or otherwise changed orders can be surfaced before the wallet is asked to sign anything.

## Gated commerce features

The current repository keeps the following capabilities separately gated:

- sweep execution;
- offer acceptance; and
- native listing.

Their UI or underlying code may exist before they are production-enabled. Public documentation must continue to call them **Gated** until their specific safety and release gates have passed.

## The user's final check still matters

Transaction-policy validation reduces the chance of an unsafe or unintended wallet prompt, but users should still read their wallet's final transaction or signature request. Net Vision's goal is to make that prompt the final confirmation of a previously reviewed action, not the first place a user discovers what the application intends to do.
