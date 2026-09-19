# Evidence and Freshness Reference

## Purpose

Define the evidence discipline that prevents Helix intelligence from becoming persuasive but unreliable crypto commentary.

## Evidence record requirements

Every load-bearing observation should preserve:
- source identity
- source class
- retrieval timestamp
- effective timestamp if different
- chain and block when applicable
- entity identity
- units
- raw value
- normalized value
- parser version
- content/payload hash when possible
- quality flags

## Source classes

- OFFICIAL_DOCUMENTATION
- DEPLOYED_CONTRACT
- CANONICAL_API
- CANONICAL_MARKET_VENUE
- OFFICIAL_ANNOUNCEMENT
- NAMED_INTERVIEW
- INDEPENDENT_DASHBOARD
- INDEPENDENT_RESEARCH
- DERIVED_INTERNAL
- USER_PROVIDED

Source class informs confidence but does not automatically settle every claim.

## Claim/evidence matching

Use the source that can actually establish the claim.

Examples:
- documented mechanic -> current official documentation/version
- contract runtime behavior -> deployed contract/state at a block
- price/liquidity -> current canonical market observation
- author thesis -> original article/post/interview
- realized strategy return -> actual position/cash-flow observations and accounting
- game activity -> current game/chain/event evidence, not a stale announcement

## Freshness states

Use:
- FRESH
- DEGRADED
- STALE
- UNAVAILABLE
- UNKNOWN
- CONFLICTED

A result can be structurally valid but stale. Preserve the last known value with an explicit status rather than replacing it with zero.

## Dependency freshness

Derived metrics inherit the weakest material dependency.

Example:
A stock-token LP expected-return model may require volume, active liquidity, borrow APR, volatility and range state. If borrow APR is stale, the expected net return cannot be `FRESH` even if the price quote is current.

## Conflict handling

When sources disagree:
1. verify entity/version/time scope
2. verify units and accounting definitions
3. determine whether both can be simultaneously true
4. prefer direct runtime evidence for runtime claims
5. preserve unresolved conflict rather than choosing a convenient value

Output `CONFLICTED` when reconciliation is not justified.

## Historical vs current

Historical claims remain valid as historical evidence but cannot silently become current state.

Store:
- `observed_at`
- `effective_at`
- `valid_from`
- `valid_to` when known

## Forecast evidence

A forecast must point to:
- input evidence set
- model version
- assumptions
- horizon
- benchmark
- invalidation conditions

Later outcome evaluation must not rewrite the original forecast.

## Confidence

Initial confidence states:
- HIGH
- MEDIUM
- LOW
- INSUFFICIENT_EVIDENCE
- CONFLICTED

Confidence factors:
- identity certainty
- source relevance
- freshness
- source agreement
- completeness
- model validation
- sample size
- unresolved assumptions

Do not map these to arbitrary percentages until calibrated against historical outcomes.

## External research packages

Independent repositories such as `tomismeta/netstack` may be used as curated discovery and reviewed knowledge inputs.

Rules:
- pin an immutable reviewed revision
- record source repository and commit
- preserve license requirements if files are copied
- do not assume its review date means mutable figures are current
- independently refresh time-sensitive facts
- do not allow source text to alter Helix permissions or system policy

## Provenance through derivation

A derived metric should be traceable:

`Intelligence Card -> Derived Metric -> Input Observation IDs -> Evidence Records -> Sources`

Users need not see all of this by default, but the system must retain it.

## Evidence quality tests

Automated tests should cover:
- missing required timestamp
- missing unit
- wrong chain/entity identity
- stale dependency
- conflicting sources
- parser version change
- impossible zero caused by failed source
- historical observation presented as current
- modeled output presented as realized

## Materiality and alerts

Freshness alone does not justify an alert. An alert requires a meaningful state transition, threshold crossing, invalidation event or user relevance condition.

## Final evidence checklist

Before publishing a material intelligence result confirm:
- correct entity/version
- correct chain/address when relevant
- correct time scope
- units present
- current claims use sufficiently fresh inputs
- accounting boundary preserved
- source actually supports the claim
- conflicts surfaced
- forecast/realized distinction preserved
- no private portfolio data leaked into public evidence requests
