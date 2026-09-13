import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe('buy checkout authority', () => {
  it('only CartCheckout may call /api/trade/buy/prepare', () => {
    const offenders: string[] = [];
    for (const file of walk(join(WEB_ROOT, 'components'))) {
      const src = readFileSync(file, 'utf8');
      if (!/fetch\s*\(\s*['"`]\/api\/trade\/buy\/prepare['"`]/.test(src)) continue;
      const rel = relative(WEB_ROOT, file);
      if (rel === 'components/cart/CartCheckout.tsx') continue;
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('CartCheckout does not implement a second wallet connector', () => {
    const src = readFileSync(join(WEB_ROOT, 'components/cart/CartCheckout.tsx'), 'utf8');
    expect(src).toMatch(/useWalletConnectModal/);
    expect(src).toMatch(/Connect wallet/);
    expect(src).not.toMatch(/useConnect\(/);
  });

  it('BuyDrawer does not fetch prepare or send a transaction', () => {
    const src = readFileSync(join(WEB_ROOT, 'components/BuyDrawer.tsx'), 'utf8');
    expect(src).not.toMatch(/fetch\s*\(/);
    expect(src).not.toMatch(/sendTransactionAsync/);
    expect(src).toMatch(/BuyNowButton/);
  });
});
