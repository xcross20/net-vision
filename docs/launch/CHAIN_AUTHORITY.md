# Chain authority record

Timestamp (UTC): **2026-09-10T15:42:23Z** (RPC) / **2026-09-10T15:43Z** (OpenSea collection)
Intended RPC: `https://rpc.mainnet.chain.robinhood.com` (official public mainnet; rate-limited)
Conclusion: **canonical Robinhood Chain mainnet is chain ID 4663**. Net Vision **1311 is wrong**.

Trading remains **disabled**. This record is the authority for wallet, policy, simulation RPC, and explorers.

---

## 1. Authoritative Robinhood docs

| Field | Value |
| --- | --- |
| Source | https://docs.robinhood.com/chain/connecting |
| Observed | Mainnet Chain ID **4663**, currency ETH, explorer `robinhoodchain.blockscout.com` |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Testnet | Chain ID **46630** |
| Contracts | USDG / WETH on https://docs.robinhood.com/chain/contracts |

---

## 2. Live RPC `eth_chainId`

| Field | Value |
| --- | --- |
| Source | `POST https://rpc.mainnet.chain.robinhood.com` `eth_chainId` |
| Observed | `0x1237` = **4663** |
| Testnet RPC | `0xb626` = **46630** |
| `eth_blockNumber` | `0x38c309b` (chain is live) |
| Conflict | Old Net Vision RPC `https://rpc.robinhood.com/mainnet` — TLS handshake failure |

---

## 3. Button Presser contract

| Field | Value |
| --- | --- |
| Address | `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` |
| RPC | official mainnet (4663) |
| `eth_getCode` | **present** (hex length 26128, not empty) |
| `name()` | **Button Presser** |
| `symbol()` | **PRESSER** |
| OpenSea | same address, `chain: "robinhood"`, `total_supply: 62093` |

---

## 4. OpenSea Button Presser

| Field | Value |
| --- | --- |
| Source | `GET https://api.opensea.io/api/v2/collections/button-presser` (200, no key) |
| Network | `contracts[0].chain` = **`robinhood`** |
| Contract | `0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2` |
| Listing currency | USDG `0x5fc5360d0400a0fd4f2af552add042d716f1d168`, decimals 6, `chain: robinhood` |
| Explorer in `/api/v2/chains` | `https://robinhoodchain.blockscout.com` (matches official 4663 explorer) |
| Numeric `chain_id` | **not present** on public `/api/v2/chains` robinhood object |
| Best listing / NFT / fulfillment | **401** without API key this session. Staging Railway key was not usable from local CLI (`Invalid API key`). |

**Residual:** protocol fulfillment JSON (the object Buy prepare would send to the wallet) was **not** captured. OpenSea **network** for the collection is the slug `robinhood` whose explorer is the 4663 chain. Buy E2E must log fulfillment `chain` / `chain_id` before `TRADING_ENABLED`.

---

## 5. USDG

| Field | Value |
| --- | --- |
| Address | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| `eth_getCode` | present (proxy-sized, hex length 342) |
| `decimals()` | **6** |
| `symbol()` | **USDG** |
| OpenSea listing currency | same address, decimals 6 |

---

## 6. Seaport v1.5

| Field | Value |
| --- | --- |
| Address | `0x0000000000000068F116a894984e2DB1123eB395` (canonical Seaport 1.5) |
| `eth_getCode` on 4663 RPC | **present** (hex length 47964) |

---

## 7. Fletcher (secondary only)

| Field | Value |
| --- | --- |
| Source | `GET https://fletcher-worker.onrender.com/config` |
| Observed | `chainId: 4663`, USDG same address |
| Role | Corroboration. **Not** canonical. Do not copy Fletcher UniversalRouter onto Net Vision. |

---

## Conflicts

| Claim | Value | Status |
| --- | --- | --- |
| Net Vision `@net-vision/chain-config` (pre-fix) | 1311 | **Wrong** vs docs + live RPC |
| Net Vision wallet RPC | `rpc.robinhood.com/mainnet` | **Dead** (TLS fail) |
| Net Vision explorer | `explorer.robinhood.com` | **Not** official Blockscout |
| Official + RPC + Fletcher | 4663 | **Agree** |
| OpenSea | slug `robinhood`, explorer Blockscout | Agrees with 4663 **network**; numeric id not in public chain catalog |

---

## Sibling-risk (hardcoded 1311 / stale RPC / explorer)

| Location | Role | Migration |
| --- | --- | --- |
| `packages/chain-config/src/index.ts` | **SoT** | `ROBINHOOD_CHAIN.id = 4663`, official RPC + Blockscout; `PAYMENT_TOKENS.USDG.chainId = ROBINHOOD_CHAIN.id` |
| `apps/web/lib/wallet/robinhood.ts` | Duplicate wagmi chain | Re-export `ROBINHOOD_CHAIN` from chain-config |
| `packages/opensea-client` `ROBINHOOD_CHAIN_ID` | Duplicate numeric | Re-export `ROBINHOOD_CHAIN.id` |
| `apps/web/lib/market/diagnostic.ts` | OpenSea slug via `id === 1311` | Use `OPENSEA_CHAIN_SLUG` |
| `TokenCommercePanel.tsx` | Hardcoded cart chainId | `ROBINHOOD_CHAIN.id` |
| Tests / `.env.example` | Fixtures | Follow SoT |
| `middleware.ts` CSP `connect-src` | Old RPC host | Allow official RPC |
| `Footer.tsx` | explorer.robinhood.com | `CHAIN_DISPLAY.explorerUrl` |
| `docs/adr/0004` | Historical 1311 | Note superseded |
| SIWE | none in repo | n/a |
| Payment router | already fail-closed unless 4663 | Compatible after SoT change |

Do **not** search-replace 1311 in ADRs/history without a supersession note.

---

## Conclusion

**Canonical identity:** Robinhood Chain mainnet **chain ID 4663**, ETH gas, RPC `https://rpc.mainnet.chain.robinhood.com`, explorer `https://robinhoodchain.blockscout.com`.

Button Presser, USDG (6 decimals), and Seaport 1.5 **exist as code on that chain**. OpenSea places Button Presser on network slug `robinhood` with USDG.

**1311 is retired** as a Net Vision chain id.

Trading stays off until Buy E2E records an OpenSea fulfillment payload on this chain.
