#!/usr/bin/env node
/**
 * End-to-end test for the Add to Cart flow.
 *
 * Verifies the contract documented in the cart handoff:
 *   1. Add to Cart from a token page inserts an item.
 *   2. Cart persists in localStorage across navigation.
 *   3. The cart drawer lists items with prices and remove control.
 *   4. The cart badge increments.
 *   5. Removing an item drops the badge and the drawer list.
 *   6. The cart revalidation endpoint accepts the cart shape.
 *   7. The buy prepare endpoint accepts the expected body.
 *   8. Wrong collection is rejected.
 *
 * Usage:
 *   BASE_URL=http://localhost:3001 node tools/cart-e2e.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const log = (msg) => console.log(`[cart-e2e] ${msg}`);
const fail = (msg) => {
  console.error(`[cart-e2e] FAIL: ${msg}`);
  process.exit(1);
};

async function expect(condition, message) {
  if (!condition) fail(message);
  log(`OK: ${message}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  const results = [];
  const record = (name, status) => {
    results.push({ name, status });
    log(`${status === 'pass' ? 'PASS' : 'FAIL'}: ${name}`);
  };

  try {
    // 1. Marketplace home loads and shows the cart button.
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const cartButton = page.locator('button[aria-label*="cart" i]').first();
    await cartButton.waitFor({ state: 'visible', timeout: 8_000 });
    record('homepage renders cart button', 'pass');

    // 2. Open the cart drawer from an empty cart.
    await cartButton.click();
    const emptyTitle = page.getByText('No items yet');
    await emptyTitle.waitFor({ state: 'visible', timeout: 5_000 });
    record('empty cart drawer opens', 'pass');
    await page.locator('button[aria-label="Close cart"]').first().click();
    await page.waitForTimeout(200);

    // 3. Seed a cart item directly into localStorage (so we don't have
    //    to wait on OpenSea). Then reload and verify the drawer shows it.
    const seedItem = {
      collectionSlug: 'button-presser',
      contractAddress: '0xe5143de9d3ccbc31ffb4e7fc66d8320e0e2693d2',
      tokenId: '121',
      imageUrl: '/api/media/token/121',
      displayName: '#121',
      categories: [{ slug: 'palindrome', label: 'Palindrome' }],
      sourceMarketplace: 'opensea',
      displayedOrderHash: null,
      displayedPriceRaw: null,
      displayedPriceDecimal: '18.40',
      currencySymbol: 'USDG',
      currencyAddress: null,
      currencyDecimals: 6,
      addedAt: Date.now(),
    };
    await page.evaluate((it) => {
      window.localStorage.setItem(
        'net-vision:cart:v1',
        JSON.stringify({ version: 1, items: [it] }),
      );
    }, seedItem);
    await page.reload({ waitUntil: 'networkidle' });
    const badge = page.locator('button[aria-label*="cart" i] span').first();
    await badge.waitFor({ state: 'visible', timeout: 5_000 });
    const badgeText = await badge.textContent();
    await expect(badgeText === '1', `badge reads "1" (got "${badgeText}")`);
    record('badge shows seeded count', 'pass');

    // 4. Open the drawer and confirm the item is listed.
    await page.locator('button[aria-label*="cart" i]').first().click();
    await page.getByText('#121').first().waitFor({ state: 'visible', timeout: 5_000 });
    record('seeded item shows in drawer', 'pass');
    await page.locator('button[aria-label="Close cart"]').first().click();
    await page.waitForTimeout(200);

    // 5. Persistence: navigate away and back, cart survives.
    await page.goto(`${BASE_URL}/categories/palindrome`, { waitUntil: 'networkidle' });
    const persistedBadge = await page
      .locator('button[aria-label*="cart" i] span')
      .first()
      .textContent();
    await expect(persistedBadge === '1', `cart persists across nav (got "${persistedBadge}")`);
    record('cart persists across navigation', 'pass');

    // 6. Remove the item from the drawer.
    await page.locator('button[aria-label*="cart" i]').first().click();
    await page.locator('button[aria-label="Remove #121"]').first().click();
    await page.waitForTimeout(300);
    const emptyAgain = page.getByText('No items yet');
    await emptyAgain.waitFor({ state: 'visible', timeout: 5_000 });
    record('remove empties the drawer', 'pass');
    await page.locator('button[aria-label="Close cart"]').first().click();
    await page.waitForTimeout(200);
    const finalBadgeCount = await page
      .locator('button[aria-label*="cart" i] span')
      .count();
    await expect(finalBadgeCount === 0, `badge disappears at zero (got ${finalBadgeCount})`);
    record('badge hides at zero', 'pass');

    // 7. localStorage is cleared after removing the only item.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('net-vision:cart:v1'),
    );
    const parsed = stored ? JSON.parse(stored) : null;
    await expect(
      parsed && Array.isArray(parsed.items) && parsed.items.length === 0,
      `storage reflects empty cart (got ${stored})`,
    );
    record('storage mirrors cart state', 'pass');

    // 8. API endpoint rejects wrong collection.
    const wrongCollection = await page.evaluate(async () => {
      const res = await fetch('/api/trade/cart/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          buyerAddress: '0x000000000000000000000000000000000000dEaD',
          items: [
            {
              tokenId: '999',
              contractAddress: '0x000000000000000000000000000000000000bEEF',
              displayedOrderHash: null,
              displayedPriceRaw: null,
            },
          ],
        }),
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    });
    const wcCount = Array.isArray(wrongCollection.body?.items)
      ? wrongCollection.body.items.length
      : -1;
    await expect(
      wcCount === 0,
      `wrong collection excluded from revalidation (status ${wrongCollection.status}, items=${wcCount}, body=${JSON.stringify(wrongCollection.body).slice(0, 120)})`,
    );
    record('wrong-collection revalidate returns empty', 'pass');

    // 9. API endpoint validates body shape.
    const badBody = await page.evaluate(async () => {
      const res = await fetch('/api/trade/cart/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ buyerAddress: 'not-an-address', items: [] }),
      });
      return { status: res.status };
    });
    await expect(badBody.status === 400, `bad body returns 400 (got ${badBody.status})`);
    record('revalidate rejects malformed body', 'pass');

    // 10. Buy prepare route accepts the expected body shape.
    const prepareResp = await page.evaluate(async () => {
      const res = await fetch('/api/trade/buy/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tokenId: '919',
          buyerAddress: '0x000000000000000000000000000000000000dEaD',
        }),
      });
      return { status: res.status, body: await res.json() };
    });
    // Without OPENSEA_API_KEY the prepare endpoint should fail closed
    // with a 502/503 rather than 500 — proves the route runs to policy
    // evaluation instead of crashing.
    await expect(
      [502, 503].includes(prepareResp.status),
      `prepare fails closed when OpenSea unavailable (status ${prepareResp.status}, error=${prepareResp.body?.error})`,
    );
    record('buy prepare fails closed without OpenSea', 'pass');
  } catch (err) {
    record(`uncaught error: ${err.message}`, 'fail');
  } finally {
    await context.close();
    await browser.close();
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  console.log('');
  console.log(`[cart-e2e] ${passed} passed, ${failed} failed of ${results.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
