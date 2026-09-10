# Buy fulfillment authority

**Status:** **BLOCK** — live payload not yet captured. Request shape is now pinned to OpenSea's published schema.

**Date:** 2026-09-10  
**Official docs:** `POST https://api.opensea.io/api/v2/listings/fulfillment_data`  
(`generate_listing_fulfillment_data_v2`)

## Required request (OpenSea)

```json
{
  "listing": {
    "hash": "<order_hash>",
    "chain": "robinhood",
    "protocol_address": "0x0000000000000068F116a894984e2DB1123eB395"
  },
  "fulfiller": {
    "address": "<buyer 0x>"
  }
}
```

Required fields: `listing.hash`, `listing.chain`, `listing.protocol_address`, `fulfiller.address`.

## Net Vision vs docs (found during Phase 2)

| Field | chain-config / policy | Notes |
| --- | --- | --- |
| Chain slug | `robinhood` | Matches `OPENSEA_CHAIN_SLUG` |
| Numeric chain | **4663** | `ROBINHOOD_CHAIN.id` |
| Collection | `0xE5143de9D3CcBc31Ffb4e7Fc66d8320e0E2693D2` | Button Presser |
| USDG | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` decimals **6** | Must match consideration token |
| Seaport | `0x0000000000000068F116a894984e2DB1123eB395` | v1.5 allowlist |

**P0 found and fixed in `feat/usdg-checkout-hardening`:**  
`OpenSeaClient.getListingFulfillmentData` previously POSTed a flat `{ orderHash, fulfillerAddress, chain }`. That is **not** a valid `FullfillListingRequest`. Prepare could never have obtained real fulfillment data. The client now sends the official nested body. Tests pin the wire shape.

## Live capture (2026-09-10, staging OpenSea key)

Source: `GET /api/v2/listings/collection/button-presser/all` then official fulfillment POST. HTTP **200**.

| Field | Observed | Net Vision SoT | Match |
| --- | --- | --- | --- |
| `transaction.chain` | **4663** | `ROBINHOOD_CHAIN.id` | PASS |
| listing `chain` | `robinhood` | `OPENSEA_CHAIN_SLUG` | PASS |
| `transaction.to` | `0x0000000000000068F116a894984e2DB1123eB395` | `ALLOWLISTED_PROTOCOLS.seaport15` | PASS (OpenSea labels protocol `seaport1.6`; **address** matches) |
| NFT contract | `0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2` | Button Presser | PASS |
| token id | `30781` | from listing | PASS |
| USDG token | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` | `PAYMENT_TOKENS.USDG` | PASS |
| USDG decimals | 6 | 6 | PASS |
| consideration total | 1376100 + 13900 = **1390000** | price.current.value 1390000 | PASS |
| `transaction.value` | `0` | ERC-20 settlement | PASS |
| function | `fulfillAdvancedOrder` | encoder | PASS after encode fix |
| hex `data` field | **absent** | prepare previously expected `transaction.data` | **was BLOCK; encoder added** |
| `msg.value` | 0 | 0 | PASS |
| NFT recipient | `input_data.recipient` = fulfiller | calldata must mention buyer | encoder includes recipient |
| conduitKey | `0x61159fef…1d5e` | not in chain-config | **spender is conduit, not Seaport** |
| zone | `0x000056f7000000ece9003ca63978907a00ffd100` | not allowlisted (call target is Seaport) | note |
| fee recipient | `0x0000a26b00c1f0df003000390027140000faa719` | OpenSea fee | expected |

Dummy fulfiller `0x0000…0abc` used for capture (not a real buyer). Signatures omitted from git.

**Residual P0 for live money:** ERC-20 allowance spender must be the **conduit** derived from `conduitKey` / `fulfillerConduitKey`, not Seaport. `usdg-status` still labels Seaport as provisional.

## Operator recapture

Operator command (staging env, do not commit the API key):

```bash
railway run -e staging -s web -- node apps/web/scripts/capture-listing-fulfillment.mjs
```

Must record, redacted:

- order hash, token id, seller, protocol address
- USDG consideration token + amount
- calldata `to`, selector, `value`
- conduit / zone / approvals
- comparison vs chain-config + policy

Until that file section is filled from a **200** OpenSea response for a real Button Presser listing:

**USDG CHECKOUT remains BLOCK.** Do not set `TRADING_ENABLED=true`.
