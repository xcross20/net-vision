#!/usr/bin/env node
/**
 * End-to-end checks for the category listing-status filters,
 * infinite loading, and the token-id-to-Presser identity used by
 * Button Presser cards and details.
 *
 * Notes on data scope:
 * - OpenSea's public orderbook endpoint only returns the most recent
 *   ~200 active listings, all of which currently happen to be 5-digit
 *   Button Presser tokens. So for `digits-3?status=listed` we expect
 *   an empty grid (no recent 3-digit listings) and a populated grid for
 *   `digits-3?status=not-listed`. For `digits-5?status=listed` we
 *   expect a populated grid with 5-digit listings.
 *
 * Usage: BASE_URL=http://localhost:3001 node tools/category-e2e.mjs
 */
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
const results = [];

function logPass(name) {
  results.push({ name, status: 'pass' });
  console.log(`[category-e2e] PASS: ${name}`);
}
function logFail(name, error) {
  results.push({ name, status: 'fail', error });
  console.log(`[category-e2e] FAIL: ${name}: ${error}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  try {
    // 1. Filter UI is present with both status pills.
    await page.goto(`${baseUrl}/categories/digits-3`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const statusFilter = page.getByRole('group', { name: 'Filter by listing status' });
    const listedPill = statusFilter.getByRole('link', { name: /Listed/ });
    const notListedPill = statusFilter.getByRole('link', { name: /Not listed/ });
    if (!(await listedPill.isVisible())) throw new Error('Listed pill not visible');
    if (!(await notListedPill.isVisible())) throw new Error('Not listed pill not visible');
    logPass('filter pills render for both listing statuses');

    // 2. digits-5 listed view has populated cards (5-digit listings exist).
    await page.goto(`${baseUrl}/categories/digits-5?status=listed`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.locator('a[href^="/tokens/"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    const d5Cards = page.locator('a[href^="/tokens/"]');
    const d5Count = await d5Cards.count();
    if (d5Count < 1) throw new Error(`digits-5 listed view rendered no token cards (got ${d5Count})`);
    logPass(`digits-5 listed view populates cards (count=${d5Count})`);

    // 3. Switch to not-listed for digits-5, expect cards.
    await notListedPill.click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.locator('a[href^="/tokens/"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    const d5NotCount = await page.locator('a[href^="/tokens/"]').count();
    if (d5NotCount < 1) throw new Error(`digits-5 not-listed view rendered no token cards (got ${d5NotCount})`);
    logPass(`digits-5 not-listed view populates cards (count=${d5NotCount})`);

    // 4. Infinite scroll appends cards on digits-3 not-listed (large set).
    await page.goto(`${baseUrl}/categories/digits-3?status=not-listed`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.locator('a[href^="/tokens/"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    const before = await page.locator('a[href^="/tokens/"]').count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(
      (initial) => document.querySelectorAll('a[href^="/tokens/"]').length > initial,
      before,
      { timeout: 15_000 },
    );
    const after = await page.locator('a[href^="/tokens/"]').count();
    if (after <= before) {
      throw new Error(`infinite load did not append cards: ${before} -> ${after}`);
    }
    logPass(`digits-3 not-listed infinite load appended cards (${before} -> ${after})`);

    // 5. Token 628 detail page keeps #628 in title and media.
    await page.goto(`${baseUrl}/tokens/628`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.getByRole('heading', { name: '#628' }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('img[alt="Button Presser #628"]').first().waitFor({ state: 'visible', timeout: 10_000 });
    logPass('token detail keeps #628 in the title and media alt');

    // 6. Token 628 detail links to OpenSea with /628 suffix.
    const openSeaLink = page.getByRole('link', { name: 'View on OpenSea' }).first();
    const openSeaHref = await openSeaLink.getAttribute('href');
    if (!openSeaHref?.endsWith('/628')) {
      throw new Error(`OpenSea link ended unexpectedly: ${openSeaHref}`);
    }
    logPass('OpenSea link on token detail ends with /628');
  } catch (error) {
    logFail('uncaught', error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
    await browser.close();
  }

  const passed = results.filter((result) => result.status === 'pass').length;
  const failed = results.filter((result) => result.status === 'fail').length;
  console.log(`[category-e2e] ${passed} passed, ${failed} failed of ${results.length}`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(`[category-e2e] FAIL: ${error.message}`);
  process.exit(1);
});
