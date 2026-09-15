# A3 Closeout Report

**Verdict: A3 PASS**  
**Date:** 2026-09-08  
**Staging SHA after merge:** `5e1403e892b1a709af2f90a2e74f273ef1320330` (PR #15)

## What A3 proved

SQL event/reconciliation writers hold a canonical Button Presser market universe and stay healthy under live Stream.

| Gate | Result |
|---|---|
| Soak | ~27.8h from 2026-09-07 10:45 UTC |
| `eventProjectionFailures` | 0 |
| Staging worker | online; Stream connected |
| SQL write p95 | 27 ms (budget 250 ms) |
| Universe | 62,095 `token_market_state` rows; only **#62094 / #62095** above `official_supply=62093` (discovery envelope) |
| Production `sqlWriter` | absent |
| PR #15 CI `check` | SUCCESS |
| PR #15 | MERGED to `staging` 2026-09-08 14:58 UTC |

## What A3 did not prove

Staging UI still reads `MARKET_READ_MODEL=blob`. Categories “Syncing” is the blob TTL/readiness gate, not an A3 writer failure.

## Production incident (not an A3 fail)

2026-09-08 12:32 UTC production Postgres PANIC `No space left on device` (5 GB volume). Volume grown to 20 GB; recovery ready 14:11 UTC; worker resumed. Control signal restored. Infra follow-up (disk alerts, WAL rate) is not A4.

## Git

| Ref | SHA |
|---|---|
| `origin/staging` (post-A3) | `5e1403e` |
| PR #15 head | `7fdf359` |
| `origin/main` (production) | `fa1fad2` |
| Pre-#15 staging | `737daed` |

Do not start A4 from `737daed`. A4 rebases onto `5e1403e`.
