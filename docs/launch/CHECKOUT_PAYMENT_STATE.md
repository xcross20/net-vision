# Checkout Payment-State Spec — Selected Payment Authority

**Status:** Pre-launch blocker on PR #53.
**Scope:** Cart checkout (`apps/web/components/cart/*`), payment routes (`/api/payment/*`), and any UI that references USDG state outside USDG selection.
**Author:** Net Vision engineering, post-review feedback 2026-09-12.
**Implements:** the **Selected-Payment Invariant** (defined in §2).

---

## 1. Problem statement

Three competing states currently appear in checkout when a non-USDG asset is selected:

| Signal | Source | What it says |
| --- | --- | --- |
| ETH tile is highlighted | `selectedAssetId === 'eth'` | "ETH is selected." |
| CTA says "Insufficient USDG" | `usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT'` | "You don't have enough USDG." |
| Footer says "USDG balance: 0" | unconditional render of `usdgStatus?.balance` | "Your USDG balance is 0." |
| (Hidden in code) `routeStatus === 'COMING_SOON'` for ETH/NET | `/api/payment/methods` returns it | "ETH/NET settlement isn't live." |

These three signals are simultaneously visible to the user even though they should collapse into **one authoritative payment state** that depends only on the *selected* payment asset.

The deeper bug is **structural**, not textual. The CTA logic in `apps/web/components/cart/CartCheckout.tsx` derives:

```ts
const insufficient = usdgStatus?.balance.state === 'KNOWN_INSUFFICIENT';
const routedSelected = phase.payment.assetId !== 'USDG';
// ...
const ctaDisabled = insufficient || routedSelected || usdgStatus?.spender.address == null || needsApprove;
const ctaLabel = insufficient
  ? 'Insufficient USDG'
  : routedSelected
    ? 'Conversion to USDG not live'
    : needsApprove
      ? `Approve ${payment(currentTotal, currency)}`
      : 'Continue to Review';
```

USDG state drives both the CTA and the disabled reason even when the user has selected ETH/NET/stocks. The footer at line 1063 prints "USDG balance: …" unconditionally. The `OrderSummary` `currency` prop is hard-coded to USDG.

The picker at `apps/web/components/cart/CheckoutPaymentPicker.tsx` line 118–119 conflates two distinct concepts:

```ts
const offered = method ? method.available : asset.status === 'ENABLED';
```

`available` and `routeStatus` are different fields on the backend; the UI treats them as one. ETH/NET may be policy-allowed (`available: true`) but have no executable settlement route (`routeStatus: 'COMING_SOON'`), so they appear selectable.

This is a **P0 pre-launch UX/state bug**, per the Net Vision operating manual:

> A finding is incomplete until every other consumer of the same mechanism is inspected (missing→0, missing→[], OpenSea mixed with catalog, wall-clock cache vs revision, user-supplied id trusted as verification). — Operating Manual v1.1, §Sibling risk.

---

## 2. Selected-Payment Invariant

> **PAYMENT-SELECTION INVARIANT.** Once a payment asset is selected, all payment-specific state — balance, allowance, required input amount, insufficiency messaging, approval messaging, fee messaging, and CTA state — must derive from that selected asset and its executable quote. USDG state may not control or appear in payment-specific UX unless USDG itself is the selected input asset. An asset that is policy-allowed but has no executable settlement route must render as **unavailable / Coming soon** rather than selectable.

Encodings of the invariant:

1. `selectedPaymentStatus.balance` MUST be the balance of `selectedPaymentStatus.assetId`, never a different asset.
2. `selectedPaymentStatus.allowance` MUST be the allowance of `selectedPaymentStatus.assetId` for the resolved spender (or `NOT_REQUIRED` for native ETH).
3. `selectedPaymentStatus.requiredInputRaw` MUST be derived from a fresh quote for `selectedPaymentStatus.assetId` against the current cart's `requiredUsdgRaw`. If no executable quote exists, `requiredInputRaw` is `null` and `routeStatus` is `COMING_SOON`.
4. The checkout CTA MUST be a single function of `selectedPaymentStatus`, never a parallel read of USDG state.
5. The "USDG balance" footer MUST be hidden when `selectedPaymentStatus.assetId !== 'USDG'`. (Replace with "ETH balance: …" when ETH is selected, etc.)
6. The `OrderSummary` `currency` MUST equal `selectedPaymentStatus.symbol`. The "Total" row MUST show the selected asset's amount with a secondary USDG-equivalent line (`≈ X.XX USDG`) when the asset is non-USDG.

---

## 3. Data model — `SelectedPaymentStatus`

Replaces the current ad-hoc `usdgStatus + paymentMethods + usdgQuote` triple with one shape.

```ts
// apps/web/lib/payment/selected-payment-status.ts (new file)

import type { Address, Hex } from 'viem';

export type RouteStatus =
  | 'AVAILABLE'           // live settlement route; balances and quotes are authoritative
  | 'COMING_SOON'         // no live settlement route; selection must be blocked
  | 'REGION_RESTRICTED'   // blocked by buyer region / KYC; selection must be blocked
  | 'UNSUPPORTED';        // explicit backend disablement; selection must be blocked

export type AmountKnowledge =
  | { state: 'UNKNOWN'; raw: string | null }
  | { state: 'KNOWN_SUFFICIENT'; raw: string }
  | { state: 'KNOWN_INSUFFICIENT'; raw: string };

export type AllowanceState =
  | { kind: 'NOT_REQUIRED' }                                    // native ETH
  | { kind: 'REQUIRED'; spender: Address | null; allowance: AmountKnowledge };

export type SelectedPaymentStatus = {
  // Identification
  assetId: string;                  // 'usdg' | 'eth' | 'netnet-net' | 'rh-aapl' | ...
  symbol: string;                   // 'USDG' | 'ETH' | 'NET' | 'AAPL' | ...

  // Settlement
  routeStatus: RouteStatus;
  routeReasonCode?: string | null;  // backend-provided machine code
  routeNote?: string | null;        // human-readable explanation

  // Quote (required input in the SELECTED asset, not USDG)
  quoteId: string | null;           // null when no live quote exists
  requiredInputRaw: string | null;  // bigint as string; null when route unavailable

  // Wallet state for the SELECTED asset
  balance: AmountKnowledge;
  allowance: AllowanceState;

  // USDG-equivalent view (for the secondary line on the order summary)
  purchaseValueUsdgRaw: string | null;  // bigint as string; always present when quote exists

  // Fees in the SELECTED asset
  serviceFeeBps: number;
  serviceFeeRaw: string | null;        // in selected asset units; null when no quote
};
```

### Derived CTA states

The CTA MUST be derived from `SelectedPaymentStatus` via a single pure function:

```ts
// apps/web/lib/payment/checkout-cta.ts (new file)

export type CheckoutCta =
  | { kind: 'continue'; label: 'Continue to Review' }
  | { kind: 'approve'; label: string /* "Approve <amount> <symbol>" */ }
  | { kind: 'insufficient'; label: string /* "Insufficient <symbol>" */ }
  | { kind: 'route_unavailable'; label: string /* "<symbol> payments not available yet" */ }
  | { kind: 'wallet_required'; label: 'Connect wallet' }
  | { kind: 'switch_network'; label: 'Switch to Robinhood Chain' }
  | { kind: 'review_required'; label: string /* "Review <N> items" */ };

export function deriveCheckoutCta(input: {
  selected: SelectedPaymentStatus | null;
  isConnected: boolean;
  onRobinhood: boolean;
  cartItemCount: number;
  canBuy: boolean;
}): CheckoutCta;
```

This replaces the current `primaryCheckoutAction(...)` + ad-hoc `ctaLabel` chain in `CartCheckout.tsx`.

---

## 4. API contract — `/api/payment/status`

A single new endpoint that returns the `SelectedPaymentStatus` for a given (buyer, asset, cart). Replaces the current `/api/trade/usdg-status` and supplements `/api/payment/quote`.

### Request

```http
POST /api/payment/status
Content-Type: application/json

{
  "buyer": "0x…",
  "assetId": "usdg" | "eth" | "netnet-net" | "rh-aapl" | "rh-nvda" | …,
  "requiredUsdgRaw": "1430000000",   // string, USDG 6dp
  "cartItems": [
    { "tokenId": "1", "contractAddress": "0x…", "displayedOrderHash": "0x…", "displayedPriceRaw": "1430000000" }
  ]
}
```

### Response — `AVAILABLE` route

```json
{
  "assetId": "usdg",
  "symbol": "USDG",
  "routeStatus": "AVAILABLE",
  "quoteId": "quote_abc123",
  "requiredInputRaw": "1430000000",
  "balance": { "state": "KNOWN_SUFFICIENT", "raw": "1500000000" },
  "allowance": {
    "kind": "REQUIRED",
    "spender": "0x0000…Seaport/conduit",
    "allowance": { "state": "KNOWN_INSUFFICIENT", "raw": "0" }
  },
  "purchaseValueUsdgRaw": "1430000000",
  "serviceFeeBps": 0,
  "serviceFeeRaw": "0"
}
```

### Response — `COMING_SOON` route (ETH/NET pre-launch)

```json
{
  "assetId": "eth",
  "symbol": "ETH",
  "routeStatus": "COMING_SOON",
  "routeReasonCode": "ROUTE_NOT_DEPLOYED",
  "routeNote": "ETH settlement ships in a follow-up release.",
  "quoteId": null,
  "requiredInputRaw": null,
  "balance": { "state": "UNKNOWN", "raw": null },
  "allowance": { "kind": "NOT_REQUIRED" },
  "purchaseValueUsdgRaw": "1430000000",
  "serviceFeeBps": 0,
  "serviceFeeRaw": null
}
```

### Response — `REGION_RESTRICTED` (stocks pre-launch)

```json
{
  "assetId": "rh-aapl",
  "symbol": "AAPL",
  "routeStatus": "REGION_RESTRICTED",
  "routeReasonCode": "REGION_BLOCKED",
  "routeNote": "Stock-token payments are not yet enabled in your region.",
  "quoteId": null,
  "requiredInputRaw": null,
  "balance": { "state": "UNKNOWN", "raw": null },
  "allowance": { "kind": "REQUIRED", "spender": null, "allowance": { "state": "UNKNOWN", "raw": null } },
  "purchaseValueUsdgRaw": "1430000000",
  "serviceFeeBps": 200,
  "serviceFeeRaw": null
}
```

### Status codes

- `200` — body returned (above).
- `400` — invalid `assetId` or malformed `requiredUsdgRaw`.
- `503` — `{ error: 'trading_temporarily_disabled', surface: 'sweep' }` (via the kill-switch on the route). The existing kill-switch guards on `/api/trade/*` and `/api/offers/*` are unaffected.

### Implementation notes
- The endpoint internally calls the same `resolveApprovalSpender` + `readContract(balanceOf/allowance)` chain used by `readUsdgStatus`, parameterized over `assetId`.
- For native ETH, `allowance.kind === 'NOT_REQUIRED'`, `balance` is read via `getBalance(buyer)`, and `requiredInputRaw` is computed from a fresh ETH→USDG quote (only meaningful when route is `AVAILABLE`).
- For NET and stocks, the read mirrors USDG with the token's `contractAddress` and `decimals` from `chain-config`.
- `purchaseValueUsdgRaw` is always present (even on `COMING_SOON`) so the order summary can render the USDG equivalent line.

---

## 5. UI changes

### 5.1 `CartCheckout.tsx`

**Remove:**
- The `usdgStatus` state hook and its 8-second poll effect.
- The `usdgQuote` state hook and its quote poll effect.
- The lines `const insufficient = …`, `const needsApprove = …`, the `ctaLabel` ternary chain.
- The unconditional "USDG balance / Allowance / Required" footer that renders even when a non-USDG asset is selected.
- `assertCanSelectPaymentAsset('USDG')` inside `onCheckout` — replaced by a runtime check on the selected `routeStatus`.

**Add:**
- A single `selectedPaymentStatus` state, derived from `phase.payment.assetId` and a fresh `/api/payment/status` fetch (one fetch on `payment_select` entry, then poll every 8s).
- A single `deriveCheckoutCta(selectedPaymentStatus, …)` call that replaces the current `primaryCheckoutAction` + `ctaLabel` chain.
- A `<PaymentStatusFooter status={selectedPaymentStatus} />` that renders the balance / allowance / required lines for the **selected** asset only. Hidden when `routeStatus !== 'AVAILABLE'`.
- A guard in `onCheckout`: if `selectedPaymentStatus?.routeStatus !== 'AVAILABLE'`, render the `route_unavailable` CTA and refuse to advance.

**Net diff target:** ~80 lines removed, ~40 lines added.

### 5.2 `CheckoutPaymentPicker.tsx`

**Add to `PaymentAvailability`:**

```ts
export type PaymentAvailability = {
  assetId: string;
  available: boolean;        // policy allowed (kept for backward-compat reads)
  feeBps: number;
  routeStatus: RouteStatus;  // NEW — distinguishes 'AVAILABLE' from 'COMING_SOON'
  routeReasonCode?: string | null;
  routeNote?: string | null;
};
```

**Replace** the tile-state derivation at line 118–119:

```ts
// Before (bug):
const offered = method ? method.available : asset.status === 'ENABLED';
const regionBlocked = method?.reasonCode === 'REGION_RESTRICTED' || method?.reasonCode === 'REGION_UNKNOWN';

// After (fix):
const routeStatus: RouteStatus =
  method?.routeStatus ?? (asset.status === 'ENABLED' ? 'AVAILABLE' : 'UNSUPPORTED');
const offered = routeStatus === 'AVAILABLE';
const regionBlocked = routeStatus === 'REGION_RESTRICTED';
const comingSoon = routeStatus === 'COMING_SOON';
```

**Tile rendering matrix:**

| `routeStatus` | `available` | Tile state | `disabledLabel` | selectable? |
| --- | --- | --- | --- | --- |
| `AVAILABLE` | `true` | Normal | — | Yes |
| `AVAILABLE` | `false` | Disabled | `Coming soon` | No |
| `COMING_SOON` | `true` | **Disabled** | `Coming soon` | **No** |
| `COMING_SOON` | `false` | Disabled | `Coming soon` | No |
| `REGION_RESTRICTED` | any | Disabled | `Unavailable in your region` | No |
| `UNSUPPORTED` | any | Disabled | `Coming soon` | No |

This is the matrix the reviewer specified in §"I would change four things before launch".

**Badge updates:**

| Group | Today's badge | After |
| --- | --- | --- |
| Crypto Payments (USDG, ETH, NET) | `Instant · Global access` | USDG row: `Active` (green). ETH/NET rows: `Coming soon` (amber). |
| Stock Token Payments | `Real stocks. On-chain.` | `Region restricted · Coming soon` |

### 5.3 `OrderSummary.tsx`

**Props changes:**

```ts
// Add:
selectedAsset: { assetId: string; symbol: string; routeStatus: RouteStatus };
// Existing `selectedAsset: 'USDG' | 'ETH' | 'NET' | string` becomes this richer shape.

orderSummaryRows: {
  pay: string;                       // "0.000431 ETH"
  payEquivalentUsdg: string | null;  // "1.430 USDG" (null when USDG itself is selected)
  purchaseValueUsdg: string;         // always USDG (the row the user actually pays against)
  fee: string;                       // "0.00 USDG" / "+0.5% service fee"
};
```

**Rendering rules:**

- `Pay: 1.430 USDG` when USDG selected.
- `Pay: 0.000431 ETH ≈ 1.430 USDG` when ETH selected and `routeStatus === 'AVAILABLE'`.
- `Pay: ETH — coming soon` when ETH selected and `routeStatus !== 'AVAILABLE'`.
- `Purchase value: 1.430 USDG` always renders the USDG value of the cart.
- `Fee: 0.00 USDG` always renders in USDG (matches the underlying settlement).

---

## 6. Sibling-risk surface (must be touched or verified)

| Surface | Why it must be inspected | Action |
| --- | --- | --- |
| `apps/web/components/cart/CartCheckout.tsx` | The bug origin. | Rewrite per §5.1. |
| `apps/web/components/cart/CheckoutPaymentPicker.tsx` | Conflates `available` and `routeStatus`. | Per §5.2. |
| `apps/web/components/cart/OrderSummary.tsx` | Hard-codes USDG currency and fee label. | Per §5.3. |
| `apps/web/components/portfolio/PortfolioView.tsx` | May reference USDG state in non-USDG contexts. | Audit; remove any USDG leak. |
| `apps/web/components/sweep/SweepDrawer.tsx` | Uses cart/USDG state. | Audit; ensure selected-asset invariant when sweep is unblocked. |
| `apps/web/lib/cart/checkout-machine.ts` | Asserts `assertCanSelectPaymentAsset('USDG')` only. | Add `assertRouteExecutable(selectedPaymentStatus.routeStatus)`. |
| `apps/web/lib/cart/primary-action.ts` | Returns CTA from a USDG-state view. | Deprecate; replace with `deriveCheckoutCta`. |
| `apps/web/app/api/trade/usdg-status/route.ts` | Will be replaced by `/api/payment/status`. | Keep for one release, then delete. Mark as deprecated. |
| `apps/web/lib/trade/usdg-status.ts` | Per-asset USDG slice. | Keep `readUsdgStatus` as a thin wrapper around the new `readSelectedPaymentStatus({ assetId: 'usdg', … })`. |

---

## 7. Tests

All tests live in `apps/web/lib/payment/` and `apps/web/components/cart/`.

### 7.1 `selected-payment-status.test.ts` (pure helpers)

Covers `deriveCheckoutCta` across the cartesian product:

| `routeStatus` | `balance.state` | `allowance` | Expected `kind` / `label` |
| --- | --- | --- | --- |
| `AVAILABLE` | `KNOWN_SUFFICIENT` | `KNOWN_SUFFICIENT` (allowance) | `continue` / `Continue to Review` |
| `AVAILABLE` | `KNOWN_SUFFICIENT` | `KNOWN_INSUFFICIENT` | `approve` / `Approve <amount> <symbol>` |
| `AVAILABLE` | `KNOWN_INSUFFICIENT` | any | `insufficient` / `Insufficient <symbol>` |
| `AVAILABLE` | `UNKNOWN` | any | `route_unavailable` / `<symbol> balance unknown` |
| `COMING_SOON` | any | any | `route_unavailable` / `<symbol> payments not available yet` |
| `REGION_RESTRICTED` | any | any | `route_unavailable` / `Stock payments not available in your region` |
| `UNSUPPORTED` | any | any | `route_unavailable` / `<symbol> payments not available yet` |
| any | any | any | when not connected → `wallet_required` |
| any | any | any | when not on Robinhood → `switch_network` |

Each row gets a vitest assertion. Asset matrix: `usdg`, `eth`, `net`, `aapl`, `nvda`, `tsla`, `coin`, `msft`, `spy`, `googl`, `amzn`, `spcx` — 12 assets × 9 CTA rows × 3 connectivity states = ~324 test cases. Use `it.each`.

### 7.2 `payment-status.test.ts` (server-side route)

Covers the `/api/payment/status` endpoint:

- USDG: `routeStatus='AVAILABLE'`, balance + allowance authoritative.
- ETH: `routeStatus='COMING_SOON'` until ETH→USDG router ships.
- NET: `routeStatus='COMING_SOON'` until NET→USDG router ships.
- AAPL/NVDA/etc.: `routeStatus='REGION_RESTRICTED'` until stock-token routes ship.
- Unknown `assetId` → `400`.
- Missing `requiredUsdgRaw` → `400`.
- Missing `buyer` → `400`.
- Trading disabled (kill-switch) → `503`.

### 7.3 `cart-checkout-integration.test.ts` (component-level)

A React Testing Library suite that mounts `<CartCheckout />` with a stubbed `useCart` and verifies the rendered CTA / footer / order summary for each combination of:

- Selected asset: USDG / ETH / NET / AAPL.
- Balance state: KNOWN_SUFFICIENT / KNOWN_INSUFFICIENT / UNKNOWN.
- Allowance state: KNOWN_SUFFICIENT / KNOWN_INSUFFICIENT / UNKNOWN.
- Route status: AVAILABLE / COMING_SOON / REGION_RESTRICTED.

Snapshot assertions cover:

1. CTA text matches `deriveCheckoutCta(...)`.
3. Footer renders the selected asset's balance line (not USDG when ETH selected).
3. `OrderSummary` `currency` equals `selectedPaymentStatus.symbol`.
4. `OrderSummary` shows USDG equivalent when selected asset is non-USDG.

### 7.4 `checkout-payment-picker.test.tsx`

A React Testing Library suite that mounts `<CheckoutPaymentPicker />` and verifies the tile state matrix in §5.2 for every (asset, `routeStatus`) pair. Snapshots: tile is disabled, label is `Coming soon` or `Unavailable in your region`, click handler is a no-op.

### 7.5 Sibling-risk regression

Run the full `vitest` suite + `npx tsc --noEmit`. All 50 prior test files + the 4 new ones must pass.

---

## 8. Implementation plan (atomic commits)

Each commit is independently revertible. Do NOT bundle these.

| # | Commit | Files | Notes |
| --- | --- | --- | --- |
| 1 | `feat(payment): add SelectedPaymentStatus + deriveCheckoutCta` | `lib/payment/selected-payment-status.ts` (new), `lib/payment/checkout-cta.ts` (new), `lib/payment/selected-payment-status.test.ts` (new), `lib/payment/checkout-cta.test.ts` (new) | Pure data + pure function. 324 test cases via `it.each`. |
| 2 | `feat(api): add /api/payment/status` | `app/api/payment/status/route.ts` (new), `lib/payment/read-selected-payment-status.ts` (new), `app/api/payment/status/payment-status.test.ts` (new) | Server-side authority for the new endpoint. Includes kill-switch guard. |
| 3 | `fix(cart): rewrite CartCheckout.tsx to derive CTA from selectedPaymentStatus only` | `components/cart/CartCheckout.tsx` | Removes `usdgStatus`/`usdgQuote` parallel state, the `insufficient = usdgStatus?…` line, the conditional USDG footer, the `ctaLabel` ternary. Calls `deriveCheckoutCta`. |
| 4 | `fix(cart): distinguish routeStatus from available in CheckoutPaymentPicker` | `components/cart/CheckoutPaymentPicker.tsx` | Per §5.2 tile matrix. Disabled tiles show `Coming soon` or `Unavailable in your region`. |
| 5 | `fix(cart): show selected-asset + USDG equivalent in OrderSummary` | `components/cart/OrderSummary.tsx` | Per §5.3. Receives the richer `selectedAsset` shape. |
| 6 | `chore(api): deprecate /api/trade/usdg-status` | `app/api/trade/usdg-status/route.ts` | Adds `Deprecation: true` header. Plan to remove after one release. |
| 7 | `test(cart): component-level checkout-payment-state regression` | `components/cart/CartCheckout.test.tsx` (new), `components/cart/CheckoutPaymentPicker.test.tsx` (new) | Per §7.3, §7.4. |
| 8 | `docs(launch): selected-payment-state spec` | `docs/launch/CHECKOUT_PAYMENT_STATE.md` (this file) | Pinned in the repo. |

### Migration safety

- `/api/trade/usdg-status` is kept (deprecated) so any external caller has one release to migrate.
- `readUsdgStatus` becomes a thin wrapper around `readSelectedPaymentStatus({ assetId: 'usdg', … })` so existing unit tests still pass.
- `primaryCheckoutAction` is retained (returns the same labels for USDG-only flows) but no longer drives the live CTA.

### Rollback

- `git revert` per-commit. Each commit is isolated to one surface (data model / route / component / spec).
- Production hot-fix path: revert commit 3 (CartCheckout.tsx) restores the previous, buggy behavior, but it is still safer than the broken invariant because it explicitly refuses non-USDG selections via the existing `assertCanSelectPaymentAsset('USDG')` in `onCheckout`.

---

## 9. Rollout

1. Open a PR on `release/promote-staging-to-main` titled `fix(cart): enforce selected-payment-state invariant in checkout` (or a new branch off staging).
2. CI must be green: `npx tsc --noEmit`, full `vitest run`, build.
3. Deploy to staging. Smoke test on `https://web-staging-46e2.up.railway.app`:
   - Select USDG → CTA is `Continue to Review` (or `Approve <amount> USDG`); footer shows USDG balance.
   - Select ETH → tile is disabled with `Coming soon`; CTA / footer do not render ETH-only paths that leak USDG state.
   - Select AAPL → tile is disabled with `Region restricted`.
   - Order summary on USDG shows `Pay 1.430 USDG / Purchase value 1.430 USDG / Fee 0`.
4. Update `LAUNCH_CANDIDATE.md` candidate SHA to the new tip.
5. Open a follow-up release PR (`staging → main`) titled `release: fail-closed marketplace v1.1 (selected-payment-state)`.
6. Close PR #53 with a pointer comment to the new release PR.

---

## 10. Open questions (resolved before implementation)

- [x] Order summary shows both selected asset and USDG equivalent — confirmed.
- [x] ETH/NET/stock tiles disabled with `Coming soon` / `Region restricted` — confirmed.
- [x] Full spec first, then code — confirmed.

---

## Appendix A — Before/after for the bug repro

### Before (today's bug)

User selects ETH in checkout:

```
ETH [selected]
─────────────────────────────────────
Order Summary
Item price: 1.430 USDG
Marketplace fee: 0.00 USDG
Total: 1.430 USDG

Insufficient USDG.    ← CTA, derived from usdgStatus (WRONG asset)
─────────────────────────────────────
USDG balance: 0        ← unconditional USDG footer (WRONG asset)
Allowance: 0
Required: 1.430 USDG
```

### After (the fix)

User selects ETH in checkout:

```
ETH [Coming soon]    ← tile disabled, routeStatus='COMING_SOON'
─────────────────────────────────────
Order Summary
Pay: ETH — coming soon
Purchase value: 1.430 USDG
Marketplace fee: 0.00 USDG

ETH payments not available yet.   ← CTA from deriveCheckoutCta
─────────────────────────────────────
[no footer — selected route is unavailable, no authoritative USDG / ETH state to show]
```

When ETH settlement ships (post-launch Stage 2), the same screen will become:

```
ETH [selected]
─────────────────────────────────────
Order Summary
Pay: 0.000431 ETH ≈ 1.430 USDG
Purchase value: 1.430 USDG
Marketplace fee: 0.00 USDG

Insufficient ETH.    ← CTA, derived from selected ETH balance (CORRECT)
─────────────────────────────────────
ETH balance: 0.000200 ETH
Required: 0.000431 ETH
```

That is the exact invariant this spec implements.