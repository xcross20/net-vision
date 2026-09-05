# Category sales attribution

A sale is a marketplace event. Category volume is an overlapping analytical attribution of that event.

## Rule

When token T sells for price P at time t:

1. Persist the sale once on the global tape.
2. Snapshot the facet slugs T has **at sale time**.
3. Write one attribution row per slug.
4. Each matching category’s volume and sales counters increase by P / 1.

Do not sum category volumes to produce collection volume. Collection volume is the unattributed sale tape.

## Schema

```text
sales
  sale_event_id
  token_id
  price
  currency
  marketplace
  occurred_at
  order_hash
  buyer
  seller
  ingested_at

sale_category_attributions
  sale_event_id
  token_id
  category_slug
  taxonomy_version
  facet_source          -- metadata | derived | curated | game
  attributed_price
  occurred_at
```

Historical queries read attributions, not live `token_facets`. If lucky-number curation later changes, old sales keep the snapshot.

## Example

`#777` sells for 5,000 USDG. If facets at sale time are digits-3, material-brass, palindrome, repdigit, triple, lucky:

```text
digits-3                    += 5,000
material-brass              += 5,000
palindrome                  += 5,000
repdigit                    += 5,000
triple                      += 5,000
lucky                       += 5,000
Button Presser global tape  += 5,000   (once)
```

If Plate has not been extracted yet, Brass is **not** attributed. Missing metadata is not inferred.

## Windows

```text
volume_24h / 7d / 30d / all_tracked
sales_24h / 7d / 30d / all_tracked
average_sale, median_sale
highest_sale, highest_sale_token_id
```

All windows are computed from persisted events. Label the UI **Tracked since `<historyStartedAt>`**. Never fabricate pre-indexer OpenSea history.

## Floor history

Floor and listed-supply snapshots are appended on a coarse interval from verified LISTED members only. A syncing category does not publish a floor as if it were complete.
