# Net Vision Launch UX, Cross-Surface Consistency, and QA Technical Specification
Version: 1.0
Workstream: P5
Branch: `feat/launch-readiness`

## 1. Mission

Eliminate contradictory states across:
- homepage
- market
- categories
- token page
- cart
- checkout
- portfolio
- activity
- alerts/watchlist

This is not a broad visual redesign.

## 2. Product Invariants

### One identity
`collectionId + tokenId`

### One listing semantic
Only `LISTED` is listed/executable.

### Stale is visible
Never present stale as current.

### Unknown is visible
Never present unknown as unlisted.

### One executable price
Token/category/cart/checkout must trace to the same accepted order snapshot or explicitly show drift.

### One owner
Portfolio and token detail cannot silently disagree.

### One health vocabulary
Coverage and realtime connection are separate.

### No false zero
Unavailable never becomes zero.

## 3. Canonical UI Language

Data:
- Live
- Indexed
- Partial
- Stale
- Last known
- Unavailable

Listing:
- Listed
- Unlisted
- Verification pending
- Stale listing state

Transaction:
- Review
- Revalidating
- Price changed
- Awaiting signature
- Submitted
- Confirming
- Confirmed
- Failed
- Partially completed

Ownership:
- Owned
- Ownership verification delayed
- Not owned
- Ownership unknown

## 4. Cross-Surface Contract Tests

For one asset fixture compare:
- category card
- token page
- cart
- portfolio
- activity

Fields:
- collection
- token ID
- display
- listing state
- price
- raw price
- currency
- seller
- freshness
- facets
- order hash where applicable

## 5. Golden Journeys

### J1 Browse and Buy
Market -> category -> token -> cart -> checkout -> receipt -> portfolio

### J2 Price Drift
Category -> cart -> price changes -> warning -> accept -> execute

### J3 Listing Disappears
Cart -> revalidation -> unavailable -> no wallet prompt

### J4 Portfolio
Connect -> inventory -> listed -> token -> watchlist

### J5 Mixed Collections
Portfolio -> Button + Gear -> filters -> open each safely

### J6 Upstream Failure
Market unavailable -> no false zero -> last-known labeled

## 6. Responsive Matrix

Widths:
- 375
- 430
- 768
- 1024
- 1440+

Run all golden journeys at:
- 375
- 1440

Spot-check the rest.

## 7. Accessibility

Minimum:
- keyboard navigation
- visible focus
- semantic controls
- dialog focus trapping
- Escape closes drawers/dialogs
- labeled forms
- announced errors
- warnings not color-only
- meaningful alt text

## 8. Failure Mode UX

### Marketplace unavailable
Show current data unavailable and timestamped last-known values only.

### Postgres unavailable
Never present empty as current.

### Worker stale
Show degraded indexing/realtime state.

### Wallet provider unavailable
Browsing continues. Buying disabled with explanation.

### Wrong chain
Block execution and show required network.

### Transaction partial failure
Show which items succeeded and which did not.

## 9. Visual Regression

Stable fixtures:
- normal category
- partial category
- listed token
- stale token
- unavailable floor
- mixed portfolio
- normal cart
- changed-price cart
- partial checkout
- mobile variants

Do not snapshot live volatile production prices.

## 10. Modularity

Consistency tests must work for both Button and Gear.

No test may assume:
- all tokens are Buttons
- all facets are number/material
- all IDs are globally unique
- all titles use Button formatting

## 11. Release Severity

P0:
- wrong token transaction
- wrong price transaction
- false ownership
- false executable listing
- cross-collection identity collision

P1:
- stale shown as current
- contradictory surfaces
- missing price drift warning
- broken mixed-collection portfolio

P2:
- visual polish
- low-impact responsive issue
- minor copy/accessibility issue

No release with open P0.

## 12. E2E Automation

Required:
- route load
- connect/disconnect
- category navigation
- token navigation
- cart persistence
- order revalidation
- no unexpected transaction prompt
- receipt flow
- portfolio refresh
- Button/Gear coexistence

## 13. Observability

Frontend error context:
- route
- surface
- collectionId
- operation
- error class

Never log private keys or sensitive wallet payloads.

## 14. Acceptance Gate

`LAUNCH CONSISTENCY PASS` requires:
- golden journeys green
- no P0
- no unexplained cross-surface mismatch
- mobile primary journeys green
- failure states tested
- mixed-collection fixture tests green
