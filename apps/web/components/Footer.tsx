import Link from 'next/link';
import { Hex } from '@/components/icons';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--nv-border)] bg-[var(--nv-bg-elev)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-8 text-xs md:flex-row md:items-center md:px-8">
        <div className="flex items-center gap-2 text-[var(--nv-text-soft)]">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[rgba(116,240,167,0.08)] text-[var(--nv-green)]">
            <Hex size={12} weight="duotone" />
          </span>
          <span className="font-semibold tracking-tight">Net Vision</span>
          <span className="text-[var(--nv-muted)]">· Non-custodial market terminal.</span>
        </div>
        <nav className="flex items-center gap-5 text-[var(--nv-muted)] md:ml-auto">
          <Link href="/market" className="hover:text-[var(--nv-text)]">
            Market
          </Link>
          <Link href="/categories" className="hover:text-[var(--nv-text)]">
            Categories
          </Link>
        </nav>
        <span className="text-[var(--nv-muted-dim)] md:ml-4">
          Button Presser on Robinhood Chain.
        </span>
      </div>
    </footer>
  );
}