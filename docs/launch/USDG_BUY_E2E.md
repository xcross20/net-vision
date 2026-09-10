# USDG Buy E2E

**Status:** **USDG CHECKOUT BLOCK** (2026-09-10)

`TRADING_ENABLED` remains false. This document is the evidence log, not a flag flip.

## Proven without a signed purchase

| Step | Evidence |
| --- | --- |
| Cart is the only buy executor | PR #26 merged. `buy-authority.test.ts` |
| OpenSea fulfillment HTTP 200 | `docs/launch/BUY_FULFILLMENT_AUTHORITY.md` |
| Request body | `{ listing: { hash, chain, protocol_address }, fulfiller: { address } }` |
| Calldata | encoded `fulfillAdvancedOrder` from `input_data` |
| Chain | 4663 |
| Seaport | `0x0000000000000068F116a894984e2DB1123eB395` (`information()` = 1.6) |
| USDG | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` decimals 6 |
| `msg.value` | 0 |
| Spender | Conduit `0x963F00d3ff000064fFCbA824b800c0000000C300` via `getConduit(fulfillerConduitKey)` |
| Conduit has code | 3190 bytes |
| Seaport open channel on conduit | true |
| Allowance eth_call | `USDG.allowance(buyer, conduit)` implemented; dummy 0xabc → 0 (call succeeds) |
| Bounded approve | cart `approve(spender, requiredRaw)` — no unlimited default |
| Revalidate after approval | cart checkout |
| Final revalidate before prepare | cart checkout |
| Balance knowledge | UNKNOWN / KNOWN_SUFFICIENT / KNOWN_INSUFFICIENT (never 0) |

## Not yet proven (blocks PASS)

| Step | Status |
| --- | --- |
| Operator wallet with USDG on 4663 | missing in this environment |
| Signed bounded approve receipt | not run |
| Signed Seaport fulfill receipt `status === success` | not run |
| NFT owner == buyer after receipt | not run |
| Listing gone / indexer reconciliation | not run |
| Activity + portfolio update | not run |

Those require a funded buyer key and an explicit, temporary trading enable for **one** operator purchase. They are **not** satisfied by unit tests.

## Operator sequence (after PR merge)

1. Do **not** set `TRADING_ENABLED=true` on production.
2. Staging-only, time-boxed: `BUY_ENABLED=true` + `TRADING_ENABLED=true` on web.
3. Connect the operator wallet on chain 4663.
4. Buy now a low-value listing (example observed: #30781 at 1.39 USDG).
5. If allowance insufficient: Approve USDG (bounded) → wait receipt → listing revalidate.
6. Prepare → policy → simulate → sign → `waitForTransactionReceipt`.
7. Confirm `receipt.status === success`.
8. Check `ownerOf(tokenId) == buyer`.
9. Check listing 404 / unavailable on revalidate.
10. Check activity + portfolio.
11. Set `TRADING_ENABLED=false` again.
12. Fill the table below and only then flip this doc to PASS.

| Field | Value |
| --- | --- |
| tokenId | |
| orderHash before | |
| approve tx | |
| purchase tx | |
| receipt status | |
| owner after | |
| listing after | |
| reconciliation latency | |

## Verdict

**USDG CHECKOUT BLOCK**

Reason: spender/conduit/encode/cart path is implemented and on-chain verified; a real-money receipt has not been produced in this environment.
