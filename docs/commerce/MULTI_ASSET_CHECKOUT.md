# Multi-Asset Checkout / Payment Router

Status: **PAYMENT ROUTER BLOCK** (architecture + fail-closed domain exist; no public enablement)
Date: 2026-09-10
PR track: `feat/payment-router` (Commerce). Not inside PR #20.
Authorities: **Payment Router** (this package) and **Purchase Engine** (existing Seaport / `transaction-policy`). They must not merge.

Public launch Buy remains **USDG → Seaport**. ETH / NET / stocks do not delay `LAUNCH PASS`.

---

## Fletcher reference (verified 2026-09-10)

Sources: [fletcher.market/docs](https://fletcher.market/docs), [fletcher.market/partners](https://fletcher.market/partners), live `GET https://fletcher-worker.onrender.com/config`, `GET /fletcher-lane`, `GET /agents.md`.

Fletcher **settles everything in USDG**. Marketplace and gacha settlement is Robinhood Chain USDG.

`$FLETCHER` lane (partners prompt, live):

```text
$FLETCHER
↓
UniversalRouter (V2_SWAP_EXACT_OUT)
↓
FLETCHER → VIRTUAL → USDG
↓
normal USDG Intake
```

Docs: that path is **“the same router as stock payments.”**

Worker verifies on-chain before treating the swap as paid:

- expected input token was sold
- net USDG received ≥ deposit
- swap sent by the user's wallet
- < 15 minutes old
- proof single-use

Invalid proof → 400. Then USDG uses the **normal** intake. They do not teach Seaport/Intake dozens of currencies.

Live Fletcher config:

```json
{ "usdg": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", "chainId": 4663, ... }
```

`$FLETCHER` token (lane): `0x5f18b02b8320ef1c5b7d7a5a8bad482a767f4716`  
`VIRTUAL`: `0xc6911796042b15d7fa4f6cde69e245ddcd3d9c31`  
UniversalRouter **address is not pinned** in `/config`; agents.md names the command (`V2_SWAP_EXACT_OUT`) and canonical V2 factory, not a hex we will copy.

---

## Net Vision split (copy the pattern, not the contracts)

```text
PAYMENT ROUTER          PURCHASE ENGINE
input asset → USDG      always USDG Seaport
```

Do **not** teach Seaport NVDA/ETH/NET. `PAYMENT_TOKENS` stays USDG-only until a route independently PASSes.

Package: `@net-vision/payment-router`

State machine:

```text
QUOTED
→ SWAP_PENDING          (skipped for USDG-direct)
→ USDG_CONFIRMED
→ LISTING_REVALIDATED
→ PURCHASE_PENDING
→ CONFIRMED

listing gone after swap → RECOVERY
(user keeps USDG; no substitute NFT; not CONFIRMED)
```

Atomic swap+fulfill is **not** assumed. Two-step until a trusted settler is verified on the **same chain as Button Presser**.

---

## P0: chain ID 1311 vs official 4663

| Source | Chain ID |
| --- | --- |
| [docs.robinhood.com/chain/connecting](https://docs.robinhood.com/chain/connecting) | **4663** mainnet, 46630 testnet |
| Fletcher `GET /config` | **4663** |
| OpenSea public `/api/v2/chains` | slug `robinhood`, explorer `robinhoodchain.blockscout.com` (no numeric id in that payload) |
| Net Vision `@net-vision/chain-config` | **1311** |
| USDG address | same hex in Fletcher, Robinhood registry, and Net Vision |

**Do not enable trading (USDG or otherwise) until** a live RPC `eth_chainId` and OpenSea fulfillment `chain_id` for Button Presser `0xE5143de9…` are recorded and `ROBINHOOD_CHAIN.id` matches.

Do **not** paste Fletcher UniversalRouter / Kerf `CHAIN_ID=4663` helper addresses onto Net Vision 1311.

`validateDirectUsdgQuote` / `validateSwapQuote` fail closed when `configuredChainId !== 4663`.

---

## Registry (identity, not symbols)

See `packages/payment-router/src/registry.ts`.

| assetId | enabled | notes |
| --- | --- | --- |
| `usdg` | **true** (direct only) | Canonical settlement |
| `eth` / `weth` | false | WETH from official registry |
| `netnet-net` | false | `0xca9c78dd…` NetNet. **Not** Cloudflare |
| `rh-net-cloudflare` | false | Registry ticker NET |
| `rh-nvda` `rh-aapl` `rh-tsla` `rh-msft` `rh-amzn` `rh-spy` `rh-spcx` | false | [Official stock registry](https://docs.robinhood.com/chain/contracts/) |

Liquidity notes (not enablement): ETH/WETH↔USDG is the deepest Uniswap pair class on the chain (SQD). NetNet NET/USDG exists (Gecko v4 pool). Stocks: 0x RFQ vs USDG at Fletcher/0x day-1; NVDA/USDG AMM exists. Fake tickers exist (SQD GME warning).

---

## Policy (both legs)

Router: asset allowlisted + enabled, chain, quote expiry, max in, min USDG out, slippage/impact caps, pinned router for swaps, Fletcher-style proof (amounts from logs, user, recency, replay).

Purchase engine: existing `validateTradeAction` on the Seaport USDG leg only. Never skip listing revalidation after a swap.

Never trust: symbol, client `usdgReceived`, UI “best route” without a quote id.

---

## UX (after USDG launch + chain-id PASS)

Payment picker + **best route** among enabled assets with balance. Show route hops and max input. Insufficient USDG is honest, not a fake 0.

Not in this PR: wallet balances, quotes, UniversalRouter calldata.

---

## Implementation in this PR

- Domain package + tests (USDG-only enabled; swaps fail closed; 1311 ≠ 4663; NET collision; replay proof; recovery transition).
- Seaport engine untouched.
- No `PAYMENT_TOKENS` expansion.
- No public UI.
- No trading flags.

## Verdict

**PAYMENT ROUTER BLOCK**

Closed for architecture: two authorities, USDG canonical, Fletcher-style proof, state machine, identity registry.

Still BLOCK for enablement:

1. Chain ID 1311 vs official 4663 (P0 for **all** money paths)
2. No verified UniversalRouter / 0x settler on the Button Presser chain
3. No staging `eth_call` of a swap leg
4. ETH / NET / stocks `enabled: false`
5. Existing BuyDrawer / receipt / USDG approve holes on the purchase engine

Next commerce work after chain-id verification: USDG-direct Buy E2E on the correct chain. Then ETH→USDG. Then NetNet NET. Then one stock (NVDA) via 0x RFQ.
