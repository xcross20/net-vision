# Multi-Asset Checkout

Status: **architecture / backlog**. Not launch-critical.
Date: 2026-09-10
Authority: transaction policy (one owner). Must not mutate SQL market reads.

**Do not enable any payment asset except USDG until that asset independently passes transaction-policy tests and live staging simulation.**

Launch Buy E2E remains: OpenSea Seaport listing denominated in **USDG** → simulate → sign. ETH, $NET, and tokenized stocks must **not** delay `LAUNCH PASS`.

---

## Why a router (not extra Seaport currencies)

Current executable path (`packages/chain-config`):

```text
PAYMENT_TOKENS = { USDG: chainId 1311, 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168, 6 decimals }
ALLOWLISTED_PAYMENT_TOKEN_SET derived from that set only
ETH is native gas, not an NFT settlement asset
```

Button listings on OpenSea are USDG consideration. Sending NET or NVDA into that Seaport order fails. Conversion must happen **before** fulfillment:

```text
USER PAYMENT ASSET (allowlisted)
        ↓
PAYMENT ROUTER (allowlisted venue)
        ↓
QUOTE + SLIPPAGE + POLICY
        ↓
SWAP → listing settlement asset (today: USDG)
        ↓
REVALIDATE NFT LISTING
        ↓
SEAPORT PURCHASE
        ↓
BUTTON TO USER
```

The firewall must validate **both legs**. No silent token substitution. No arbitrary-token routing.

---

## Registry (explicit identity, never symbol-only)

```ts
type PaymentAsset = {
  assetId: string
  symbol: string
  chainId: 1311
  kind: 'native' | 'erc20' | 'stock-token'
  contractAddress?: `0x${string}` // required unless kind=native
  decimals: number
  settlementRoutes: {
    toUSDG: {
      venue: 'uniswap-v4' | 'uniswap-v3' | '0x-rfq'
      router: `0x${string}`
      maxSlippageBps: number
    }[]
  }
}
```

**Name collision:** Robinhood registry lists **Cloudflare** as symbol `NET` at `0x116F00968269B7bfbaD4109cE591d6E74c0601d4`. Ecosystem **NetNet $NET** is `0xca9c78dd337a67f6e0077f65f5e9218719d30edf`. These must never share an `assetId`. Use `netnet-net` vs `rh-net-cloudflare`.

Do **not** copy KerfFinance `RobinhoodAddresses.sol` (`CHAIN_ID = 4663`). Net Vision is **1311**.

---

## Verified contracts (chain 1311)

Source of stock tokens: [Robinhood Chain Token Contracts](https://docs.robinhood.com/chain/contracts/) (on-chain registry). A matching ticker at another address is **not** a Robinhood Stock Token (SQD documented a fake GME with material volume).

| assetId | symbol | kind | contract | notes |
| --- | --- | --- | --- | --- |
| usdg | USDG | erc20 | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Already in `PAYMENT_TOKENS`. Launch settlement. |
| eth | ETH | native | — | Gas token. Wrap via WETH for AMM. |
| weth | WETH | erc20 | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Official registry. |
| netnet-net | NET | erc20 | `0xca9c78dd337a67f6e0077f65f5e9218719d30edf` | NetNet; **not** Cloudflare NET. |
| rh-aapl | AAPL | stock-token | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | Registry |
| rh-amzn | AMZN | stock-token | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` | Registry |
| rh-msft | MSFT | stock-token | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` | Registry |
| rh-nvda | NVDA | stock-token | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | Registry; SQD: highest stock volume |
| rh-tsla | TSLA | stock-token | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` | Registry |
| rh-spy | SPY | stock-token | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` | Registry |
| rh-spcx | SPCX | stock-token | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` | Registry |

Uniswap v4 singleton (public AMM): `0x8366a39cc670b4001a1121b8f6a443a643e40951` (PoolManager). Universal Router / Permit2 must be **re-verified on 1311** before allowlisting (do not use 4663 copies).

---

## Route feasibility (investigation, not enablement)

| Route | Evidence | Feasibility | Launch |
| --- | --- | --- | --- |
| USDG → Seaport | Live Button listings; policy already USDG-only | **Proven** | **Required** |
| ETH/WETH → USDG | SQD: WETH/USDG + ETH/USDG ~$3.74B lifetime through Uniswap v3/v4; Gecko/DEXScreener deep WETH/USDG | High | Post-launch #2 |
| NET (NetNet) → USDG | Gecko: Uniswap v4 NET/USDG ~$0.5–0.6M TVL, ~$0.3M/24h; also v2 | Medium (thin vs ETH) | Post-launch #3; commercially valuable |
| NVDA/AAPL/… → USDG | 0x RFQ day-1 for stock tokens vs USDG (Tokka); Uniswap v4 NVDA/USDG ~$133M lifetime (SQD); CLOUD hook on NVDA/USDG is **unaudited beta** | Per-token | Post-launch #4 |

**0x** is the intended RFQ venue for stock tokens (USDG base pair) and cross-chain. AMM (Uniswap) is the public ETH/NET path. Do not route stocks through unaudited hooks for production spend.

Liquidity is **not** a substitute for policy. A liquid pool that is not allowlisted is still forbidden.

---

## Security model (both legs)

```text
Payment asset allowlisted (chainId + contract, not symbol)
↓
swap router / RFQ settler allowlisted
↓
quote expiry
↓
max input (user cap)
↓
minimum USDG output
↓
slippage cap (bps)
↓
price-impact reported (not hidden)
↓
correct recipient (user)
↓
correct chain 1311
↓
swap eth_call
↓
listing revalidated (order hash + USDG consideration)
↓
Seaport semantics independently decoded
↓
NFT purchase eth_call
↓
sign
```

Atomic if a trusted settler can bundle swap+fulfill; otherwise **explicit two-step UX** with recovery: leftover USDG stays in the user wallet, cart item not confirmed, no “bought” copy.

Approvals: bounded allowance to allowlisted router/Seaport only. No unlimited approve.

---

## UX (after USDG launch)

```text
Button #777 · 428 USDG

PAY WITH
● USDG   428.00
○ NET    quote
○ ETH    quote
○ NVDA   quote   (stock-token; registry contract only)
```

Show the actual route and max spend:

```text
2.27 NVDA → 430.12 USDG → Button #777
428.00 USDG listing
  routing impact
  other costs
Max spend: 430.50 USDG equivalent
```

Quote expiry visible. If listing drifts after swap, stop and require re-ack (same as cart drift).

---

## Implementation plan (serialized, after LAUNCH PASS)

1. **USDG only** — Buy E2E + A6. No router.
2. **ETH** — wrap + Uniswap v4/v3 WETH→USDG; register Universal Router after 1311 verification; policy tests + staging sim.
3. **NetNet NET** — Uniswap NET→USDG; `assetId=netnet-net`; never Cloudflare `NET`.
4. **Stocks** — 0x RFQ first (designed for USDG base); one token (NVDA) before the basket; reject non-registry addresses.

Each step: policy tests (red then green), staging `eth_call`, then a **controlled** live swap of dust **before** NFT buy.

---

## Launch agent rules

- This file is the backlog item. **P2 POST-LAUNCH** for enablement.
- Remaining P0s for public MVP are SQL/Railway/Buy-USDG, not payment variety.
- Do not add `PAYMENT_TOKENS` entries until the route’s policy tests exist.
- Do not treat 0x / Uniswap as trusted until the **router address** is pinned in chain-config allowlist.
