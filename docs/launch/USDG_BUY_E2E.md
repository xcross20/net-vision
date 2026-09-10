# USDG Buy E2E

**Verdict: USDG CHECKOUT PASS** (2026-09-10)

Canonical first proven Net Vision commerce transaction:

`0x5c06f3c5e9bfe4197bd5a3630fc0751931255f008620d828af2c7d534b2c5e01`

Explorer: https://robinhoodchain.blockscout.com/tx/0x5c06f3c5e9bfe4197bd5a3630fc0751931255f008620d828af2c7d534b2c5e01

This is not a release-flag document. Production `TRADING_ENABLED` stays **false**. Staging trading was time-boxed for Path A and should be turned **off** after this evidence is recorded unless more staging buys are required.

Independent sources: Robinhood RPC `eth_chainId` / `eth_getTransactionReceipt` / `ownerOf` / `allowance` (2026-09-10), Blockscout tx + logs + token instance, staging `/api/v1/account/{buyer}/nfts` and `/api/categories/digits-5/sales`. Operator statement was **not** used as proof.

## Canonical Live Purchase Evidence

Transaction: `0x5c06f3c5e9bfe4197bd5a3630fc0751931255f008620d828af2c7d534b2c5e01`

| Field | Expected | Observed | Verdict | Evidence |
| --- | --- | --- | --- | --- |
| Receipt status | success (`0x1`) | `0x1` / Blockscout `result=success` | **PASS** | RPC `eth_getTransactionReceipt`; Blockscout |
| Chain | Robinhood **4663** | RPC `eth_chainId` = `0x1237` = **4663**; tx mined in that chain's Blockscout | **PASS** | RPC; explorer host `robinhoodchain.blockscout.com` |
| Sender | operator EOA | `0x2EDd82a624938383B01EC17C8aEff5b5F373A2d7` | **PASS** | `tx.from` |
| Target | Seaport 1.6 `0x0000000000000068F116a894984e2DB1123eB395` | same | **PASS** | `tx.to`; Blockscout tags Seaport 1.6 |
| Collection | Button Presser `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` | offer token + ERC-721 Transfer contract | **PASS** | calldata `offerToken`; log index 24 |
| tokenId | reviewed Button | **20343** (`0x4f77`) | **PASS** | `offerIdentifier`; ERC-721 Transfer id; `OrderFulfilled.offer` |
| NFT recipient | buyer / msg.sender | Transfer `to` = sender `0x2EDd…A2d7` | **PASS** | ERC-721 Transfer; `OrderFulfilled.recipient` |
| Seller / offerer | listing maker | `0x52cf2c9f9057fbAfD60DebfF7087101e97744637` | **PASS** | calldata `offerer`; NFT `from`; USDG seller recipient |
| USDG contract | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` | same (6 decimals) | **PASS** | `considerationToken`; two ERC-20 Transfer logs |
| USDG amount | listing consideration (seller + fee) | **1346400 + 13600 = 1360000** raw = **1.36 USDG** | **PASS** | logs 25–26; `OrderFulfilled.consideration` |
| Payment recipients | seller + OpenSea fee | seller `0x52cf…4637` 1.3464 USDG; fee `0x0000a26b…a719` 0.0136 USDG | **PASS** | ERC-20 Transfers |
| Conduit / spender | OpenSea conduit `0x963F00d3ff000064fFCbA824b800c0000000C300` from key `0x61159fef…1d5e` | offerer + fulfiller conduit keys both `0x61159fef…1d5e`; prior approve spender = conduit | **PASS** | calldata; approve tx below |
| `msg.value` | 0 (ERC-20 settlement) | `0x0` | **PASS** | `tx.value` |
| Gas | recorded | gas used **171504**; effective gas price **128028000** wei; fee **21957314112000** wei | **PASS** | receipt |
| Block | recorded | **59782020** @ `2026-09-10T23:04:46.000Z` | **PASS** | receipt; Blockscout timestamp |
| Order hash | live listing hash | `0x908347c6abf544c60378cc0b15e0048415fca813b0cd56c1936c33bfb71459c7` | **PASS** | `OrderFulfilled.orderHash`; matches earlier cart listing snapshot for #20343 |
| Calldata | `fulfillBasicOrder_efficient_6GL6yc` selector `0x00000000`; ERC20→ERC721 type 8 | same; `basicOrderType` **8**; offerAmount **1** | **PASS** | RPC input prefix; Blockscout decoded input |
| Unexpected transfers | only NFT + USDG consideration | 4 logs: OrderFulfilled + NFT Transfer + 2× USDG Transfer. No extra ERC-20/721 | **PASS** | RPC log count 4; Blockscout logs |
| Spend vs accepted listing | ≤ 1.36 USDG for this order | purchase moved **1.36 USDG** total | **PASS** | 1360000 raw |

### Prior bounded approve (same buyer, nonce 0)

| Field | Observed | Verdict |
| --- | --- | --- |
| Hash | `0xa13c5f0f11a48d885d5e4b40acd7a922696da85f070059429224916a2011479c` | success |
| Time | 2026-09-10T23:02:47Z (119s before purchase) | — |
| Token | USDG | PASS |
| Spender | conduit `0x963F00d3…C300` (not Seaport) | PASS |
| Amount | **2990000** raw = **2.99 USDG** | bounded to a 2-item cart (1.36+1.63), not MaxUint256 |
| Leftover allowance after buy | **1630000** raw = **1.63 USDG** (the unbought line) | residual — see below |

### Post-purchase

| Check | Result | Evidence |
| --- | --- | --- |
| `ownerOf(20343)` == buyer | **PASS** | RPC `ownerOf`; Blockscout token instance owner `0x2EDd…A2d7` |
| Portfolio same NFT | **PASS** | `GET /api/v1/account/0x2EDd…A2d7/nfts` → one token, `tokenId=20343`, `ownerAddress=0x2edd…a2d7` |
| Listing no longer executable | **PASS** | not in `/api/categories/digits-5/listings` first page; token `listingPrice`/`listingOrderHash` null. `OrderFulfilled` consumes the Seaport order. |
| Activity | **PASS** | `/api/categories/digits-5/sales` includes #20343 @ 1.36 USDG, buyer `0x2edd…`, seller `0x52cf…`, orderHash `0x908347c6…59c7`, `occurredAt` 1789081486000 = block time |
| Cart confirmed removal | **UNVERIFIED** from this environment (client localStorage). Code path `removeConfirmed` after receipt success exists. | — |
| Token detail owner/lastSale | **LAG** | `/api/v1/tokens/20343` still `ownerAddress: null`, `lastSaleAt: null` while portfolio/activity are correct |

### Reconciliation latency

| Surface | Observed |
| --- | --- |
| Chain inclusion | Blockscout `confirmation_duration` 101 ms |
| Approve → purchase | 119 s (human wallet time) |
| Activity vs block time | sale row timestamp **equals** block timestamp (indexer caught the event on the same unix second) |
| Portfolio vs chain | present at verification time (minutes after inclusion) |
| Token detail owner | still null at verification — **not** reconciled |

## Required evidence (architecture, from hardening PRs)

| # | Requirement | Result |
| --- | --- | --- |
| 1 | Resolve spender from conduitKey `0x61159fef…1d5e` | **PASS** — `0x963F00d3ff000064fFCbA824b800c0000000C300` |
| 2 | Code exists at spender | **PASS** — 3190 bytes |
| 3 | Derivation vs Seaport Controller | **PASS** — version 1.6, controller `0x00000000F949…Ad63` |
| 4 | USDG allowance read uses that spender | **PASS** — live leftover `allowance(buyer, conduit)=1630000` |
| 5 | Bounded approve == accepted requirement | **PASS** for the 2-item cart at approve time (2.99); leftover 1.63 after buying one |
| 6 | Approval receipt success | **PASS** — `0xa13c5f0f…479c` status success |
| 7 | Listing revalidation after approval | **PASS** live — purchase used live order `0x908347c6…59c7` |
| 8 | Prepare binds accepted order hash and price | **PASS** in code; live fill matches that hash and 1.36 USDG |
| 9 | Transaction policy | **PASS** live — Seaport target, Button Presser, USDG, spend 1.36, recipient=buyer |
| 10 | Simulation / receipt | **PASS** — receipt success (not hash-only) |

## Residuals (do not undo PASS)

1. **Leftover conduit allowance 1.63 USDG.** Approve was for two cart lines; only #20343 was purchased. Revoke or it may cover a later 1.63 USDG fill. Cart reactivity (#30) is meant to drop required amount when a line is removed; this leftover is from before that fix was deployed.
2. **Token detail `ownerAddress` / `lastSale*` lag** while portfolio and activity are correct. Sibling-risk: token page still looks unowned/untraded.
3. **Cart localStorage** not inspectable here.
4. **Production `TRADING_ENABLED` remains false.** Do not copy the staging flag to production from this PASS.

## Verdict

**USDG CHECKOUT PASS**

This transaction is the canonical first proven Net Vision commerce fill: signed Seaport `fulfillBasicOrder_efficient_6GL6yc` on Robinhood Chain 4663, Button Presser **#20343** to `0x2EDd82a6…A2d7`, **1.36 USDG** settled, portfolio and activity reconciled, listing consumed.
