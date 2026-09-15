import { createMemoryListingLeaseStore } from './listing-lease';
import { createMemoryNativeFillLock } from './native-fill-lock';
import { createMemoryPurchaseIntentStore } from './purchase-intent-store';
import { createSingleFlight } from './single-flight';
import { createWalletRateLimit } from './wallet-rate-limit';

export const purchaseIntents = createMemoryPurchaseIntentStore();
export const listingLeases = createMemoryListingLeaseStore();
export const nativeFillLock = createMemoryNativeFillLock();
export const listingFlight = createSingleFlight<unknown>(1000);
export const prepareRateLimit = createWalletRateLimit({ windowMs: 10_000, max: 8 });

export const OPENSEA_PREPARE_CONCURRENCY = Math.max(
  1,
  Math.min(16, Number(process.env.OPENSEA_PREPARE_CONCURRENCY ?? 8) || 8),
);
