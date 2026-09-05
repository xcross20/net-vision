#!/usr/bin/env node
/**
 * Visual QA screenshot script.
 *
 * Captures every primary Net Vision route at the four breakpoints
 * called out in the design brief (390 / 768 / 1440 / 1920) and saves
 * them under `.qa/<viewport>/<route>.png` so they can be diffed
 * manually before each release.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node tools/screenshot.mjs
 *   BASE_URL=https://web-production-38d29.up.railway.app node tools/screenshot.mjs
 */
import { chromium } from 'playwright';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = join(process.cwd(), '.qa');

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const ROUTES = [
  { path: '/', slug: 'home' },
  { path: '/market', slug: 'market' },
  { path: '/categories', slug: 'categories' },
  { path: '/activity', slug: 'activity' },
];

async function run() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const summary = [];

  for (const vp of VIEWPORTS) {
    const dir = join(OUT_DIR, vp.name);
    await mkdir(dir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;
      try {
        const res = await page.goto(url, { waitUntil: 'networkidle' });
        const status = res?.status() ?? 0;
        // Allow content to settle (images, animations, lazy islands)
        await page.waitForTimeout(800);
        const file = join(dir, `${route.slug}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const { size } = await stat(file);
        summary.push({ vp: vp.name, route: route.path, status, bytes: size });
        console.log(`  ${vp.name}  ${route.path.padEnd(14)} ${status}  ${(size / 1024).toFixed(0)} KB`);
      } catch (e) {
        console.error(`  ${vp.name}  ${route.path.padEnd(14)} FAILED: ${e?.message}`);
        summary.push({ vp: vp.name, route: route.path, status: 'FAIL', bytes: 0 });
      }
    }
    await context.close();
  }

  await browser.close();

  console.log('\n--- summary ---');
  for (const row of summary) {
    console.log(
      `${row.vp.padEnd(14)} ${row.route.padEnd(14)} ${String(row.status).padEnd(5)} ${row.bytes ? (row.bytes / 1024).toFixed(0) + ' KB' : ''}`,
    );
  }

  // Exit non-zero if any screenshot is suspiciously small (< 5 KB usually
  // means the page errored before any chrome rendered).
  const tooSmall = summary.filter((r) => r.bytes && r.bytes < 5 * 1024);
  if (tooSmall.length > 0) {
    console.error('\nSuspicious screenshots (likely blank):', tooSmall);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
