import Link from 'next/link';
import { Hexagon } from '@phosphor-icons/react/dist/ssr';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--color-border-subtle)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:gap-12 md:px-8 md:py-14">
        <div className="flex flex-col gap-3 md:max-w-sm">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgba(72,235,145,0.10)] text-[var(--color-net-green)]">
              <Hexagon size={14} weight="duotone" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Net Vision</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            A non-custodial market terminal for Button Presser collectors.
            Discover, watch, and trade numbered characters on Robinhood Chain.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-4">
          <FooterColumn title="Market">
            <FooterLink href="/market">All listings</FooterLink>
            <FooterLink href="/market?view=list">List view</FooterLink>
            <FooterLink href="/market?sale=live">Live offers</FooterLink>
          </FooterColumn>
          <FooterColumn title="Categories">
            <FooterLink href="/categories">All categories</FooterLink>
            <FooterLink href="/categories/digits-3">3 Digit</FooterLink>
            <FooterLink href="/categories/material-brass">Brass</FooterLink>
            <FooterLink href="/categories/palindrome">Palindromes</FooterLink>
          </FooterColumn>
          <FooterColumn title="Activity">
            <FooterLink href="/activity">Recent sales</FooterLink>
            <FooterLink href="/activity?type=offer">Offers</FooterLink>
          </FooterColumn>
          <FooterColumn title="Ecosystem">
            <FooterLink href="https://opensea.io" external>OpenSea</FooterLink>
            <FooterLink href="https://explorer.robinhood.com" external>
              Robinhood explorer
            </FooterLink>
          </FooterColumn>
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[var(--color-text-tertiary)] md:flex-row md:items-center md:px-8">
          <span>&copy; {new Date().getFullYear()} Net Vision. Non-custodial.</span>
          <span className="md:ml-auto">
            Button Presser on Robinhood Chain.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-eyebrow-muted">{title}</span>
      <div className="flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
    >
      {children}
    </Link>
  );
}