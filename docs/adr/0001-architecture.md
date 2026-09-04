# ADR 0001: Net Vision Architecture

Status: Accepted (initial slice).

## Context

Net Vision is a specialized Button Presser marketplace and analytics terminal on Robinhood Chain. The first deliverable is the Categories read-only vertical slice: deterministic numeric classification, an OpenSea read gateway, a transaction policy package, and the public-facing `/categories` directory plus detail pages.

This ADR captures the decisions in flight at v1.1 and what changes between now and live trading.

## Decisions

### 1. Modular monolith with workspace packages, not microservices.

The first version is a single deployable Next.js application that internally organizes the domain into workspace packages. Background workers, a separate Fastify service, and the production database are introduced only when indexing or analytics load makes them operationally necessary. The current packages are:

- `@net-vision/taxonomy` — deterministic numeric classifier (pure).
- `@net-vision/chain-config` — chain identifier and contract allowlist.
- `@net-vision/opensea-client` — read-only gateway with Zod schemas.
- `@net-vision/transaction-policy` — pre-signature validation.
- `@net-vision/ui` — shared design tokens and primitives.
- `@net-vision/web` — the Next.js 15 App Router app.

Rationale: keeps the first deploy small and the policy boundary visible. Each package is independently testable.

### 2. Next.js 15 App Router with server components for market pages.

Category directories and detail pages are server-rendered to minimize client JS for a high-density data terminal. Interactive elements (filters, sweep builder, transaction review) ship as client components only where required.

### 3. Deterministic taxonomy as a pure function.

`classifyNumber(input, taxonomyVersion)` returns the same result for the same input on every run. Cultural traits live in versioned curated lists so they can be revised without changing the classifier. See `packages/taxonomy`.

### 4. OpenSea API key is server-only.

The OpenSea client is the only module that touches the API key. The Next.js web app calls Net Vision API routes, never OpenSea directly. The key never has a `NEXT_PUBLIC_` prefix and is never bundled into client output.

### 5. Transaction policy is mandatory before any wallet signature.

Every executable action returned by OpenSea must pass `validateTradeAction` (and `validateSweepBasket` for sweep) before the wallet is asked to sign. Live trading is feature-flagged off (`NEXT_PUBLIC_TRADING_ENABLED=false`) until the adversarial suite passes.

### 6. Postgres + Drizzle, deferred.

The MVP Definition of Done calls for indexing the full Button Presser supply. For the read-only slice we ship a deterministic seed so the UI is meaningful without live data. The production database lands in PR 2 (per spec) along with the indexer.

### 7. Brand cohesion with NetNet.

We reuse Net Vision design tokens (dark financial-terminal palette, primary green accent, compact data density). The exact values must be cross-checked against the live `app.netnet.capital` before locking them in. See `packages/ui` for the current defaults.

## What changes before live trading

- Indexer populates the full Button Presser supply into Postgres.
- Floor snapshot job (1 minute target) computes virtual collection floors from active listings.
- Transaction policy adversarial suite must pass in CI.
- OpenSea chain identifier for Robinhood Chain must be verified against the current official docs.
- Wallet connection and SIWE-style session land before the first controlled live buy.

## What does NOT change

- No server-side private key is ever introduced.
- The Button Presser contract `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` remains the only allowlisted NFT contract.
- The OpenSea API key never reaches the browser.
- Trading fails closed.
