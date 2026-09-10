# Payment Router v2

Supersedes stale PR #21. Rebuilt on current staging. **USDG settlement is sacred.** Alternate rails only produce USDG in the buyer wallet, then the proven Seaport engine runs.

## Authorities

1. **Asset registry** — identity (`assetId` + contract), never ticker.
2. **Payment policy** — feeBps on `assetId`, jurisdiction, availability.
3. **Route engine** — how to get USDG (empty until each rail’s ROUTE PASS).
4. **Purchase engine** — unchanged USDG Seaport fill.

## Launch flags

Only `usdg` is `ENABLED`. ETH, NetNet NET, and every Stock Token stay `DISABLED` until that asset’s own IDENTITY/POLICY/ROUTE/QUOTE/SIMULATION/LIVE E2E PASS.

Cloudflare Stock Token `rh-net-cloudflare` (18 decimals) is not NetNet `netnet-net` (9 decimals).

## Geography

`GET /api/payment/methods` reads `CF-IPCountry`. US and unknown regions cannot execute Stock Tokens. The server repeats this at quote/prepare.

## Fee

Integer USDG: `ceil(listing * feeBps / 10_000)`. USDG/ETH/NET = 0 bps. Stock Tokens = 200 bps. Conversion-service fee (stated at sign time): earned on conversion, not refunded if the listing later disappears; user keeps USDG.
