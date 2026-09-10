# USDG Buy E2E

**Verdict: USDG CHECKOUT BLOCK** (2026-09-10)

`TRADING_ENABLED` remains **false**. This is not a release-flag document.

## Required evidence (this PR)

| # | Requirement | Result |
| --- | --- | --- |
| 1 | Resolve spender from observed conduitKey `0x61159fef…1d5e` | **PASS** — `0x963F00d3ff000064fFCbA824b800c0000000C300` |
| 2 | Code exists at spender | **PASS** — 3190 bytes |
| 3 | Derivation vs Seaport Controller | **PASS** — `information()` version 1.6, controller `0x00000000F949…Ad63`, `getConduit` exists=true, Seaport is an open channel |
| 4 | USDG allowance read uses that spender | **PASS** — `allowance(buyer, conduit)` not Seaport; dummy 0xabc → 0 |
| 5 | Bounded approve == accepted requirement | **PASS** — `boundedApproveAmount(requiredRaw)`; refuses 0 and MaxUint256. Cart `approve(spender, required)` |
| 6 | Approval receipt success | **BLOCK** — no operator wallet in this environment |
| 7 | Listing revalidation after approval | **PASS** in code (`CartCheckout.onApproveUsdg` revalidates after receipt) — **unproven live** |
| 8 | Prepare binds accepted order hash and price | **PASS** — `BuyPrepareBody` requires both; 409 on mismatch |
| 9 | Transaction policy PASS | **PASS** (unit): conduit spender allowed; Seaport rejected as spender when conduit resolved |
| 10 | Simulation PASS | **PARTIAL** — encoder + `eth_call` path exists. Dry-run against live listing with empty dummy from-address reverted as expected (`TRADING_ENABLED=false`). No funded-buyer simulation success. |

Live dry-run (staging env, trading **false**), listing **#30781** / 1.39 USDG / order `0x582079b0…f7f3`, fulfillment HTTP 200.

## Live signed-purchase proof (still missing)

| Field | Value |
| --- | --- |
| approval tx | not sent |
| purchase tx | not sent |
| receipt status | n/a |
| owner after | n/a |
| listing after | n/a |
| activity | n/a |
| portfolio | n/a |
| reconciliation latency | n/a |

No operator USDG wallet is available to this agent. A signed purchase would require a time-boxed staging `TRADING_ENABLED` flip, which was **not** done.

## Operator sequence (human)

1. Keep production `TRADING_ENABLED=false`.
2. Staging-only, time-boxed enable.
3. Buy now #30781 (or another low ask) on cart checkout.
4. Bounded USDG approve if needed → receipt → revalidate.
5. Prepare → policy → simulate → sign → receipt success.
6. `ownerOf` == buyer; listing unavailable; activity + portfolio.
7. Disable trading again.
8. Fill the table and change this verdict to PASS.

## Verdict

**USDG CHECKOUT BLOCK**

Architecture and on-chain spender/allowance reads are proven. A real-money receipt is not.
