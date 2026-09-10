# Stock Token payment policy

Identity is `assetId` + contract on chain 4663. Never ticker.

US requests: Stock Tokens `REGION_RESTRICTED`. Unknown country: `REGION_UNKNOWN`. No executable quote.

Non-US: jurisdiction ALLOWED, but assets remain `DISABLED` until that asset’s own route + live E2E PASS. Enabling NVDA does not enable AAPL.

Live RPC (2026-09-10), 18 decimals unless noted:

| assetId | symbol | contract | status | feeBps |
| --- | --- | --- | --- | ---: |
| rh-aapl | AAPL | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | DISABLED | 200 |
| rh-nvda | NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | DISABLED | 200 |
| rh-tsla | TSLA | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` | DISABLED | 200 |
| rh-msft | MSFT | `0xe93237C50D904957Cf27E7B1133b510C669c2e74` | DISABLED | 200 |
| rh-amzn | AMZN | `0x12f190a9F9d7D37a250758b26824B97CE941bF54` | DISABLED | 200 |
| rh-coin | COIN | `0x6330D8C3178a418788dF01a47479c0ce7CCF450b` | DISABLED | 200 |
| rh-spcx | SPCX | `0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa` | DISABLED | 200 |
| rh-spy | SPY | `0x117cc2133c37B721F49dE2A7a74833232B3B4C0C` | DISABLED | 200 |
| rh-googl | GOOGL | unpinned | RESEARCH | 200 |
| rh-net-cloudflare | NET | `0x116F00968269B7bfbaD4109cE591d6E74c0601d4` | DISABLED | 200 |

NetNet `netnet-net` is `0xca9c78dd337a67f6e0077f65f5e9218719d30edf`, symbol NET, **9 decimals**, not a Stock Token. Cloudflare Stock Token NET is hidden from checkout so the ticker cannot be selected as NetNet.

Feature flags are per `assetId`.
