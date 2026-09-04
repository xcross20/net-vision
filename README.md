# Net Vision

Net Vision is a specialized Button Presser marketplace and analytics terminal on Robinhood Chain. It is not a general NFT marketplace clone. It is a numeric market terminal with virtual collections, deterministic classification, and non-custodial trade preparation.

This repository currently ships the **Categories read-only vertical slice**: a deterministic numeric taxonomy, a strict OpenSea read gateway, a transaction-policy package with adversarial coverage, and a compact `/categories` directory plus category detail page.

Trading UI is intentionally disabled until the transaction-policy adversarial suite passes and live OpenSea endpoint validation is complete.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Layout

```
apps/
  web/                Next.js 15 web application (App Router)
packages/
  taxonomy/           Pure, deterministic numeric classifier
  chain-config/       Robinhood Chain + Button Presser contract allowlist
  opensea-client/     OpenSea v2 read gateway with Zod schemas
  transaction-policy/ Pre-signature trade validation (server-side)
  ui/                 Shared Tailwind tokens and primitives
docs/
  adr/                Architecture decision records
  security/           Transaction invariants and threat model
  integrations/       OpenSea endpoint notes
  product/            Legacy Vision interaction reference
  marketplaces/       Native orderbook, OpenSea aggregation, cross-listing
  ui/                 UI specs (categories, mobile commerce)
  test-plan.md        Definition of Done mapping
```

## Status

- PR 1 (scaffold, env validation, chain config): done
- PR 2 (taxonomy engine): done
- PR 3 (OpenSea read client, persistence layer skeleton): in progress
- PR 4 (virtual collection analytics, floors): pending live data
- PR 5 (homepage, categories, explore, token detail): categories slice live, rest pending

Trading remains feature-flagged off.

## Safety guarantees

1. No seed phrase or private key is ever requested or stored.
2. The OpenSea API key is server-only. It never crosses into the browser.
3. The Net Vision server never signs a transaction as the user.
4. Live trading is disabled until the transaction-policy adversarial suite passes.
5. The Button Presser contract `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` is the only allowlisted NFT contract.

## Deployment

This repo is configured for Railway. See `railway.toml`. The web app boots without secrets for the read-only slice; production deployment must supply `OPENSEA_API_KEY`, `ROBINHOOD_RPC_PRIMARY`, and `SESSION_SECRET`.
