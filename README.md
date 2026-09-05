# Net Vision

Specialized Button Presser marketplace and analytics terminal on Robinhood Chain. Numeric markets, official Plate materials, non-custodial buy preparation.

## Current MVP

```text
✅ realtime Stream + REST catch-up indexer
✅ Postgres authority + worker heartbeat
✅ Button category markets (Brass / Steel / digits / patterns)
✅ material metadata bootstrap
✅ live sales + read-only offers
✅ portfolio
✅ cart with listing snapshot + receipt wait
✅ hardened /api/trade/buy/prepare
🟡 Stream health + hot cancel recovery
🟡 production app security (headers + rate limits; SIWE still open)
🟡 data acceptance suite
🔒 sweep / accept offer / native listing  (flags off)
🔒 visual rebuild  (after this gate)
```

Trading is fail-closed (`TRADING_ENABLED` unset/false). Sweep and accept-offer stay independently disabled.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Layout

```
apps/
  web/                Next.js 15 (UI + operator health)
  market-worker/      Always-on OpenSea indexer (Railway second service)
packages/
  taxonomy/           Deterministic numeric classifier
  chain-config/       Robinhood Chain + Button Presser allowlist
  opensea-client/     OpenSea v2 read gateway
  transaction-policy/ Pre-signature trade validation
  ui/                 Shared tokens
```

## Safety

1. No seed phrase or private key is requested or stored.
2. OpenSea API key is server-only.
3. The server never signs as the user.
4. Live trading is disabled until you explicitly enable it.
5. The only allowlisted NFT is Button Presser `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2`.

## Deployment

Two Node services + Postgres. See `docs/deploy/RAILWAY_MARKET_WORKER.md`.

| Service | Command |
| --- | --- |
| Web | `npm run start --workspace=apps/web` |
| Market worker | `npm run start --workspace=apps/market-worker` |

Do **not** set `INDEXER_EMBEDDED=true` on web in production.

Operator health: `GET /api/v1/health/indexer`  
Dashboard: `/admin/reconcile`

Production: https://web-production-38d29.up.railway.app
