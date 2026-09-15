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

describe('Robinhood network gate authority', () => {
  it('CartCheckout does not call switchChain itself', () => {
    const src = readFileSync(join(WEB_ROOT, 'components/cart/CartCheckout.tsx'), 'utf8');
    expect(src).not.toMatch(/useSwitchChain/);
    expect(src).not.toMatch(/switchChainAsync/);
    expect(src).toMatch(/requestNetworkForAction/);
    expect(src).toMatch(/assertWalletOnRobinhood/);
  });

  it('every sendTransactionAsync / writeContractAsync site asserts 4663 first', () => {
    const offenders: string[] = [];
    for (const file of walk(join(WEB_ROOT, 'components'))) {
      const src = readFileSync(file, 'utf8');
      if (!/sendTransactionAsync|writeContractAsync/.test(src)) continue;
      const rel = relative(WEB_ROOT, file);
      if (!src.includes('assertWalletOnRobinhood') && !src.includes('assertExecutableRobinhoodChain')) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not hand-roll wallet_addEthereumChain payloads', () => {
    const offenders: string[] = [];
    for (const file of walk(join(WEB_ROOT, 'components'))) {
      const src = readFileSync(file, 'utf8');
      if (!/wallet_addEthereumChain/.test(src)) continue;
      if (src.includes('robinhoodAddEthereumChainParameter') || src.includes('wagmiAddEthereumChainParameter')) {
        continue;
      }
      offenders.push(relative(WEB_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
