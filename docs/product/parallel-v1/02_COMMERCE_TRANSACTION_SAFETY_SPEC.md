# Net Vision Commerce and Transaction Safety Technical Specification
Version: 1.0
Workstream: P2
Branch: `feat/commerce-hardening`

## 1. Mission

Complete safe:
- Buy Now
- Add to Cart
- multi-item sequential checkout

Deferred:
- Make Offer
- Accept Offer
- native listing/edit listing
- autonomous execution
- broad sweep execution

## 2. Safety Invariant

Every item is freshly revalidated immediately before execution.

```text
display
-> cart snapshot
-> review
-> revalidate
-> prepare
-> policy check
-> simulate
-> sign
-> receipt
-> reconcile
```

## 3. Cart Model

```ts
type CartItem = {
  collectionId: string
  tokenId: string
  orderSnapshot: {
    orderHash: string
    priceRaw: string
    decimals: number
    currencyAddress: string
    currencySymbol: string
    seller: string
    chainId: number
    capturedAt: number
  }
}
```

Preserve raw price, not just formatted decimal price.

## 4. Cart Rules

- explicit max item count
- no duplicate identity/order
- no silent price update
- changed order becomes a changed-item state
- disappeared listing becomes unavailable
- user explicitly accepts price/order changes

## 5. Checkout State Machine

```text
IDLE
REVIEWING
REVALIDATING
CHANGES_REQUIRE_ACCEPTANCE
READY
PREPARING_ITEM
SIMULATING_ITEM
AWAITING_SIGNATURE
SUBMITTED
CONFIRMING_RECEIPT
ITEM_CONFIRMED
ITEM_FAILED
COMPLETE
ABORTED
```

Batch checkout is not atomic unless the chain transaction truly is atomic.

## 6. Sequential Execution

For each item:
1. fetch fresh order
2. compare with accepted snapshot
3. block unaccepted drift
4. prepare
5. policy validate
6. simulate
7. request signature
8. submit
9. wait for successful receipt
10. mark confirmed
11. move to next item

If item 3 fails after items 1 and 2 succeeded, preserve confirmed status for 1 and 2.

## 7. Drift Types

```ts
type OrderDrift =
  | { type: 'NONE' }
  | { type: 'PRICE_CHANGED' }
  | { type: 'ORDER_REPLACED' }
  | { type: 'SELLER_CHANGED' }
  | { type: 'CURRENCY_CHANGED' }
  | { type: 'LISTING_REMOVED' }
  | { type: 'TOKEN_NO_LONGER_VALID' }
```

Currency change defaults to BLOCK.

## 8. Transaction Policy

Validate:
- chain ID
- collection contract
- token ID
- order hash where applicable
- payment token address
- decimals
- buyer
- seller
- max spend
- call target allowlist
- NFT consideration
- payment consideration
- recipient set
- approval scope

Never match a payment token by symbol alone.

## 9. Simulation

Before signature:
- simulate exact prepared transaction
- capture revert reason
- distinguish RPC failure vs tx revert
- if transaction payload changes, rerun simulation

## 10. Wallet Review

Show:
- collection
- token
- seller
- price
- currency
- network
- max spend
- expected number of wallet prompts

## 11. Receipt Authority

Success requires a successful chain receipt.

Never infer success from:
- wallet submission
- listing disappearance
- optimistic UI

After receipt:
- record tx hash
- refresh ownership
- trigger/await reconciliation
- refresh listing state

## 12. API Boundaries

Recommended:
- `POST /api/v1/orders/revalidate`
- `POST /api/v1/trade/prepare`
- `POST /api/v1/trade/simulate`

Each request carries:
- collectionId
- tokenId
- accepted order hash
- accepted raw price
- buyer
- chainId

## 13. Modularity Requirements

Generic commerce must not assume:
- Button Presser contract
- USDG symbol as authority
- Robinhood Chain globally
- token ID globally unique

Execution policy is supplied by collection/chain config.

## 14. Tests

### Unit
- raw price precision
- drift classification
- cart dedupe
- batch state machine
- max spend
- wrong currency
- wrong chain
- wrong buyer

### Adversarial
- malicious call target
- wrong NFT contract
- same token ID in wrong collection
- price increase
- changed recipient
- unexpected approval
- wrong decimals
- seller change
- payload regenerated after simulation

### E2E
1. add listing
2. cart
3. review
4. price changes
5. warning
6. user accepts
7. prepare
8. simulate
9. sign
10. receipt success
11. market refresh
12. portfolio refresh

## 15. Failure Simulations

- order disappears
- wallet rejects
- RPC unavailable
- simulation reverts
- receipt times out
- receipt reverts
- first item succeeds, second fails
- page reload after partial completion
- wallet account changes
- chain changes

## 16. Observability

Track:
- revalidation success/failure
- price drift
- order replacement
- simulation failures
- wallet rejection
- tx submitted
- receipt success/failure
- partial batch completion
- reconciliation latency

## 17. Acceptance Gate

`COMMERCE PASS` requires:
- no silent substitution
- exact raw price preserved
- revalidation per item
- simulation per prepared tx
- receipt required
- partial-batch semantics correct
- adversarial policy suite green
