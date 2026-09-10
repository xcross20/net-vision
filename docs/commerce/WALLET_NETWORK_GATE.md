# Wallet network gate

**Verdict: NETWORK GATE BLOCK** (2026-09-10)

Code is in `feat/wallet-network-gate`. Manual staging acceptance is not yet signed off.

Robinhood Chain mainnet is **4663** (`0x1237`). Source of truth: `@net-vision/chain-config` (`ROBINHOOD_CHAIN`, `ROBINHOOD_CHAIN_ID_HEX`, `robinhoodAddEthereumChainParameter()`).

## Authority

| Surface | Behavior |
| --- | --- |
| Browse / search / categories / activity | No gate. Any chain, or disconnected. |
| Cart review, USDG approve, Seaport purchase | `requestNetworkForAction` then `assertExecutableRobinhoodChain` |
| Offer accept | Same shared gate |
| `wallet_addEthereumChain` | Canonical public RPC + Blockscout only |

`CartCheckout` must not call `switchChain` itself.

## State model

`DISCONNECTED` · `CORRECT_NETWORK` · `WRONG_NETWORK` · `SWITCHING` · `NETWORK_NOT_CONFIGURED` · `ADDING_NETWORK` · `USER_REJECTED` · `UNSUPPORTED_WALLET` · `ERROR`

Wrong-chain UX is a first-class modal (`RobinhoodNetworkGate`), not a viem `ChainMismatchError` dump.

## Chain-change invalidation

On wallet `chainId` change: drop USDG balance/allowance, quotes, prepare, and simulation. Cart item identity stays. Executing checkout returns to browsing. After 4663 is restored, revalidate / refetch.

## Manual staging acceptance

A. Connect wallet on chain **369**.
B. Add a Button to cart.
C. Attempt checkout.
D. Polished Network Gate appears (not a raw viem error).
E. Switch to Robinhood Chain → wallet is **4663**.
F. Remove Robinhood from a test wallet; Add & Switch installs canonical config.
G. Checkout resumes; balance/allowance/listing are fresh; no stale prepare.

Do not flip `TRADING_ENABLED` as part of this PR. Do not add ETH/NET/NVDA routing here.

## Verdict

**NETWORK GATE BLOCK** until A–G are observed on staging.
