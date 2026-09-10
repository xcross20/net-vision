# Payment executor security

Not deployed. Day-1 rails do not require an on-chain executor because only USDG direct is ENABLED.

When routed rails launch, the executor must:

- accept only server-signed authorizations (not user keys)
- chain 4663, allowlisted input, allowlisted router, canonical USDG
- fee ≤ quote, minUsdgOut enforced, remainder to user
- never custodial: backend signs quotes, user signs txs

Do not implement an arbitrary-call router.
