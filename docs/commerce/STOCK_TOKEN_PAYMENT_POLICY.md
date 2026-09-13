# Stock Token payment policy

Identity is `assetId` + contract on chain 4663. Never ticker.

US requests: Stock Tokens `REGION_RESTRICTED`. Unknown country: `REGION_UNKNOWN`. No executable quote.

Non-US: jurisdiction ALLOWED and launch Stock Tokens are `ENABLED` (AAPL, NVDA, TSLA, MSFT, AMZN, GOOGL, COIN, SPCX, SPY). US and unknown geo stay blocked. Conversion to USDG is still `routeStatus=UNAVAILABLE` until a router is pinned per asset. Cloudflare Stock Token NET stays DISABLED.

Live RPC (2026-09-10), 18 decimals unless noted:

| assetId | symbol | contract | status | feeBps |
| --- | --- | --- | --- | ---: |
| rh-aapl | AAPL | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | ENABLED | 200 |
| rh-nvda | NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | ENABLED | 200 |
| rh-tsla | TSLA | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` | ENABLED | 200 |
| rh-msft | MSFT | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` | ENABLED | 200 |
| rh-amzn | AMZN | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` | ENABLED | 200 |
| rh-coin | COIN | `0x6330D8C3178a418788dF01a47479c0ce7CCF450b` | ENABLED | 200 |
| rh-spcx | SPCX | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` | ENABLED | 200 |
| rh-spy | SPY | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` | ENABLED | 200 |
| rh-googl | GOOGL | `0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3` | ENABLED | 200 |
| rh-net-cloudflare | NET | `0x116F00968269B7bfbaD4109cE591d6E74c0601d4` | DISABLED | 200 |

NetNet `netnet-net` is `0xca9c78dd337a67f6e0077f65f5e9218719d30edf`, symbol NET, **9 decimals**, not a Stock Token, and is available in every jurisdiction. Cloudflare Stock Token NET is identity-only and is omitted from `/api/payment/methods` so the ticker cannot be selected as NetNet.

Feature flags are per `assetId`.
