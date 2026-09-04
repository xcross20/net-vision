# Cross-Listing State Machine

Status: Specified. Implementation pending.

The seller flow defaults to **Net Vision native orderbook** and offers **OpenSea** as an optional second destination. A single list action can produce up to two orders: one for each marketplace.

## States

```
draft
  -> validated (server-side validation passed)
  -> preparing (OpenSea listing actions fetched and policy-checked)
  -> approval_pending (NFT approval tx sent, awaiting confirmation)
  -> listing_signature_pending (EIP-712 typed order signature requested)
  -> submitted_to_net_vision
  -> submitted_to_opensea
  -> active (at least one order confirmed onchain)
  -> cancelled (either side)
  -> failed (any required step failed)
```

## Transitions

| From | Trigger | To | Notes |
| --- | --- | --- | --- |
| draft | user clicks List | validated | Server validates bounds, ownership, and currency. |
| validated | OpenSea actions fetched | preparing | Actions are policy-checked. |
| preparing | approval required and shown | approval_pending | Approval step is separated from the listing signature. |
| preparing | approval not required | listing_signature_pending | |
| approval_pending | approval confirmed | listing_signature_pending | |
| listing_signature_pending | user signs typed data | submitted_to_net_vision and submitted_to_opensea | Signed payload is forwarded to each marketplace in turn. |
| submitted_to_* | onchain confirmation | active | The active state may include one or both marketplaces. |
| active | user cancels | cancelled | Per-marketplace cancellation is supported. |
| any | policy failure | failed | The UI surfaces the failure reason and a retry path. |

## Safety rules

- Each approval is shown as a separate explicit step with operator and scope clearly labeled.
- Unlimited approvals are opt-in only; the default is exact or bounded.
- The typed order payload is validated against the allowlisted Seaport contract and chain before the wallet is asked to sign.
- A failed step does not auto-cancel sibling steps; the user sees the partial state.

## UI surface

- The list drawer shows the state, the next required action, and any pending signatures.
- Approval step is a dedicated panel with operator, scope, and amount.
- The typed signature step shows the listing terms exactly as they will be signed.

## Implementation order

1. State machine definition (TypeScript discriminated union).
2. Server-side validation pipeline (mirrors the buy validation).
3. Drawer UI with state-driven content.
4. E2E test against mocked OpenSea and a local Seaport fixture harness.
