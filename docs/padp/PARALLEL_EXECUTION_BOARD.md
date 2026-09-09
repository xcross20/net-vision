# Parallel Execution Board

Project: Net Vision
PADP stage: **ASDOS Stage 6 — Parallel Expansion**
Authority epoch: **E2** (`280f73b` / `origin/staging`)
Updated: 2026-09-09

## Rule

Develop in parallel. Integrate into staging **serially**. Merge barriers stay closed until the previous track has staging PASS evidence.

```text
Portfolio → staging verification
Commerce  → staging verification
Gear      → staging verification
Intelligence → staging verification
Launch QA fixes
```

Do not merge two product tracks in one deploy. Do not start A6.

## Tracks

| ID | Type | Branch | Worktree | Base SHA | Status | Merge barrier |
|---|---|---|---|---|---|---|
| A5 | Authority (closed) | `staging` | — | `280f73b` | **PASS** 2026-09-09 | — |
| PADP | Process | `feat/padp-epoch-e2` | `/Users/immanuellewis/net-vision-padp` | `280f73b` | docs | may merge to staging first (no runtime) |
| P1 | Feature | `feat/portfolio-completion` | `/Users/immanuellewis/net-vision-wt-portfolio` | `280f73b` | ready, not started | closed until this PR is the only product merge |
| P2 | Feature | `feat/commerce-hardening` | `/Users/immanuellewis/net-vision-wt-commerce` | `280f73b` | ready, not started | closed until P1 staging PASS |
| P3 | Adapter | `feat/netnet-gear-foundation` | `/Users/immanuellewis/net-vision-wt-gear` | `280f73b` | ready, not started | closed until P2 staging PASS |
| P4 | Feature | `feat/basic-intelligence` | `/Users/immanuellewis/net-vision-wt-intelligence` | `280f73b` | ready, not started | closed until P3 staging PASS |
| P5 | QA | `feat/launch-readiness` | `/Users/immanuellewis/net-vision-wt-launch` | `280f73b` | ready, not started | last; also runs after each prior merge |
| A6 | Authority | — | — | — | **BLOCKED** | product proven on staging + Release Readiness |
| A7 | Authority | — | — | — | **BLOCKED** | production SQL stable |

## After every staging merge

1. CI
2. E2E / failure-mode suite
3. Cross-surface consistency (same facts, named owners)
4. Fletcher regression
5. Manual staging smoke
6. PASS / BLOCK written here

## GREEN / YELLOW / RED

| Color | Meaning | Examples |
|---|---|---|
| GREEN | Feature-local, mergeable after tests | new `lib/portfolio/**`, Gear adapter fixtures, intelligence services |
| YELLOW | Shared contract, one owner, others adapt | `packages/chain-config` additive, `market/types.ts` optional fields |
| RED | Frozen E2 / production | SQL read model, writer, worker, `MARKET_READ_MODEL`, production Postgres |

RED requires human authorization. No silent authority edits.

## Spec sources (precedence)

1. Verified repo + staging evidence
2. This board + `AUTHORITY_MAP.md` + `.agent/branch-contracts/`
3. `docs/product/parallel-v1/`
4. Fletcher UI spec
5. `buttonvision-mvp` historical only — do not restore

## Orchestrator notes

- One orchestrator. Five isolated worktrees. No “merge all”.
- If two tracks need the same shared file: one owner; the other adapts; merge shared first; rebase.
- Offers, Accept Offer, native listing, sweep stay gated until individually hardened.
- Gear is read-only until collection-specific transaction policy is proven.
