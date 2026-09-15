# Payment route acceptance

Each non-USDG asset has its **own** enablement gate. Do not enable "stocks" as a class.

Canonical settlement is USDG on Robinhood Chain `4663`.

## Asset identity (do not trust symbol)

| Canonical id | Display | Status | Notes |
| --- | --- | --- | --- |
| `USDG` | USDG | verified_enabled (code) | Direct Seaport payment. Public trading still off. |
| `ETH` | ETH | verified_enabled | Native ETH → USDG via Uniswap SwapRouter02 on 4663, then Seaport. |
| `NET` | NET (NetNet) | verified_enabled | NetNet `0xca9c78dd…` must stay distinct from Cloudflare NET. |
| `NVDA` | NVDA | verified_enabled (non-US) | One stock. Other stocks are separate ids. US stays region-restricted. |

## Per-route checklist (must all PASS)

- Exact chain-qualified contract identity
- Decimals
- Wallet balance query (unknown ≠ 0)
- Actual venue + router/settler (from live docs/on-chain, not memory)
- Real liquidity
- Executable quote bound to buyer, asset, chain, listing order hash, USDG requirement, expiry
- Max input / min USDG out / slippage cap / impact cap
- Simulation + receipt/log verification
- Replay prevention
- Independent confirmation of USDG received before Seaport prepare

## Enablement

A route becomes selectable only when `PAYMENT_ASSETS[id].status === 'verified_enabled'` **and** its dedicated env/flag is on. Code currently hard-enables only USDG.

PR #21 (`@net-vision/payment-router`) is **not** merged. Rebase/supersede against current staging before wiring quotes. Do not force-merge.
