# Payment fee policy

Fee is a USDG line item attached to `assetId`, not `kind`.

```
feeRaw = ceil(listingUsdgRaw * feeBps / 10_000)
requiredUsdgRaw = listingUsdgRaw + feeRaw
```

Never `inputAmount * 1.02`.

| assetId | feeBps |
| --- | ---: |
| usdg | 0 |
| eth | 0 |
| netnet-net | 0 |
| rh-* stock tokens | 200 |

Day-1 product copy: the 2% is a **Stock Token conversion service fee**. If the NFT listing is gone after conversion, the user keeps USDG; we do not auto-swap back.
