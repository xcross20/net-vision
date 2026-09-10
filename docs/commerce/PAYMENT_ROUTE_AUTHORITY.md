# Payment route authority

No frontend-invented router, calldata, fee, or token.

Until a venue is independently verified on 4663, `settlementRoutes` is empty and `routeStatus=UNAVAILABLE`.

Quotes (when enabled) bind: buyer, assetId, listing hash, listingUsdg, fee, minUsdgOut, router, expiry, policyVersion, jurisdiction.

Expired and reused quotes fail closed.
