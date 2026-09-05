# Railway: net-vision-market-worker

The web service must **not** be the only process. Indexing requires a second always-on service (ADR 0002).

## Services

| Service | Start command | Role |
| --- | --- | --- |
| `net-vision-web` | `npm run start --workspace=apps/web` | Next.js UI + `/api/v1/health/*` |
| `net-vision-market-worker` | `npm run start --workspace=apps/market-worker` | Listing + metadata loops, heartbeat |
| Postgres | Railway plugin | Authoritative market + worker state |

## Worker service settings

- **Replicas:** 1 (never scale horizontally — single writer)
- **Restart:** on failure
- **Shared env with web:** `OPENSEA_API_KEY`, `DATABASE_URL`, `OPENSEA_CHAIN` (if set)
- **Do not set** `INDEXER_EMBEDDED=true` on web in production
- **Do not set** `INDEXER_V2_ENABLED=false` on the worker

Build can reuse the same root Nixpacks build as web (monorepo install). Worker does not need `next build`; if the service uses the root `railway.toml` build, that is fine — start command is what differs.

### Suggested Railway start command

```bash
npm run start --workspace=apps/market-worker
```

Equivalent:

```bash
cd apps/web && npx tsx --tsconfig tsconfig.json scripts/run-market-worker.ts
```

## Acceptance after deploy

1. Hit `/api/v1/health/indexer` with **no other traffic** after deploy.
2. Within 2 minutes: `workerOnline: true`, `workerHeartbeatAt` fresh.
3. Close laptop. Wait 60 minutes with zero website traffic.
4. Re-check: heartbeat still advancing, `metadataCursor` increased (or retries draining), listing cursor/progress moved, Brass verified count non-decreasing.

## Health fields

See `GET /api/v1/health/indexer` — `workerOnline` is false when `now - workerHeartbeatAt > 60s`.
