# Market Data and Freshness

Net Vision is designed around a simple rule: **market data should say what is known, what is stale, and what is still unknown.**

The application does not treat a missing local record as proof that a Button is unlisted, and it does not turn incomplete upstream coverage into a confident zero.

## Where market data comes from

Net Vision currently uses OpenSea as the external marketplace and order-data source for Button Presser. OpenSea requests are made server-side; the browser does not receive the Net Vision OpenSea API key.

An always-on market worker ingests and verifies marketplace state and persists the read model in Postgres. The web application reads that persisted state rather than rebuilding the marketplace independently on each request.

The index combines complementary mechanisms:

- marketplace event ingestion for changes such as listings, cancellations, sales, transfers, and offers;
- REST verification and catch-up reads;
- resumable background coverage of the collection; and
- freshness and worker-health signals used to decide whether a market can be presented as Live.

## Token existence is separate from market state

Net Vision does not assume that every integer inside the Button Presser discovery range is a real NFT.

The product separates two questions:

1. **Does this Button exist?**
2. **What is its current marketplace state?**

That prevents a missing token, an unverified token, and an actually unlisted token from being collapsed into the same state.

The official existing supply currently used for coverage is **62,093** Buttons. The wider discovery envelope reaches token ID 62,095, but token ID alone is not evidence of existence.

## Listing states

Internally, Net Vision distinguishes four marketplace states:

| State | Meaning |
| --- | --- |
| `UNKNOWN` | Marketplace state has not been sufficiently verified yet |
| `LISTED` | A current active listing has been verified |
| `UNLISTED_VERIFIED` | Verification found no active listing under the current unlisted rules |
| `STALE` | Previously known state is old enough that it should not be trusted without refresh |

This state model is one of the reasons a syncing category can show known market activity without claiming its market view is complete.

## Live versus Syncing

A category's market coverage is based on the share of category members whose marketplace state has been verified.

The current product contract uses a **95% verified-coverage threshold**:

- below the threshold, the UI reports **Syncing market data**;
- at or above the threshold, the category may report **Live** and present its market metrics as authoritative, subject to normal freshness checks.

While a market is syncing, Net Vision should not present an incomplete floor or listed count as if it described the entire category.

## Floors and listed counts

A floor is calculated from verified active listings, not from every order ever observed and not from unknown tokens.

Likewise, a listed count represents Buttons in a `LISTED` state. `UNKNOWN` is not counted as unlisted merely because no local active order was found.

This distinction protects against a common marketplace-indexing failure: an upstream timeout or partial crawl should never make a healthy market suddenly appear to have no listings.

## Sales and category attribution

When a sale is observed, Net Vision can attribute that event to every category the Button belonged to at sale time. Because category memberships overlap, the same sale can appear in multiple category histories.

For that reason, category-level volume is useful for comparing category markets, but overlapping category volumes should **not** be summed into collection-wide volume.

## Offers

The current product exposes **read-only offers**. Offer acceptance remains a separately gated commerce capability and should not be interpreted as available merely because offer data can be displayed.

## Historical data

Net Vision only claims history it actually persisted. Where a metric begins after the collection itself began trading, the public interface should use language such as:

> **Tracked since _date/time_**

Net Vision should not imply that an indexed time series is complete historical OpenSea data unless that history was actually backfilled and verified.

## Data-provider outages and rate limits

External marketplace APIs can fail, throttle, or return partial data. Net Vision treats those conditions as freshness problems rather than as changes in market truth.

When upstream evidence is unavailable, the preferred behavior is to preserve the last known state with an appropriate stale or syncing signal, fail closed on actions that require fresh executable order data, and avoid rendering missing upstream data as a new zero.

## Why this matters

A market terminal is only useful if users can tell the difference between:

- no listing exists;
- Net Vision has not checked yet;
- Net Vision checked previously but the result is stale; and
- an active listing is verified now.

Net Vision's indexing model is built to preserve those distinctions.
