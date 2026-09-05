# Wallet Security Hardening V1

Net Vision is **financial infrastructure**. A compromised UI must not be
sufficient to steal user assets. The wallet remains the sole signing authority.

## P0 invariants (buy path)

Independently extracted from Seaport `protocol_data` / fulfillment calldata
— **never** copied from user intent alone:

| Check | Source |
| --- | --- |
| Token IDs | `offer[]` ERC721 items |
| Collection | `offer[].token` == Button Presser |
| Payment amount | sum of ERC20/native `consideration[]` |
| Payment token | `consideration[].token` (allowlisted) |
| Spend cap | `acceptedPriceRaw` mandatory; must equal live amount |
| Recipient | fulfiller address must appear in fulfillment calldata |
| Simulation | `eth_call` must succeed before wallet prompt |
| Target | allowlisted Seaport only |
| Chain | Robinhood Chain only |

## Kill switches

| Env | Default | Effect |
| --- | --- | --- |
| `TRADING_ENABLED` / `NEXT_PUBLIC_TRADING_ENABLED` | false | Master off |
| `BUY_ENABLED` | true (if master on) | Buy prepare |
| `SWEEP_ENABLED` | false | Sweep prepare |
| `LIST_ENABLED` | true | List flows |
| `OFFER_ENABLED` | true | Offer flows |

## Still open (P1+)

- SIWE session auth for account-state APIs  
- Rate limiting / WAF  
- Stronger CSP without unsafe-inline/eval  
- Alternate-asset checkout (blocked until USDG path is fully hardened)  
- Third-party wallet-flow review before material TVL  
