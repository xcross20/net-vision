import Link from 'next/link';
import { CHAIN_DISPLAY } from '@net-vision/chain-config';
import { NetVisionLogo } from '@/components/brand/NetVisionLogo';
import { PageContainer } from '@/components/shell/PageContainer';
import { PRIMARY_NAV } from '@/lib/nav';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--color-border-subtle)]">
      <PageContainer size="cinematic" className="flex flex-col gap-6 py-10 md:flex-row md:items-start md:gap-12 md:py-14">
        <div className="flex flex-col gap-3 md:max-w-sm">
          <NetVisionLogo size="footer" />
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            A non-custodial market terminal for Button Presser collectors.
            Discover, watch, and trade numbered characters on Robinhood Chain.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-4">
          <FooterColumn title="Navigate">
            {PRIMARY_NAV.map((item) => (
              <FooterLink key={item.href} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn title="Categories">
            <FooterLink href="/categories">All categories</FooterLink>
            <FooterLink href="/categories/material-brass">Brass</FooterLink>
            <FooterLink href="/categories/material-steel">Steel</FooterLink>
            <FooterLink href="/categories/material-anodised-aluminium">Anodised Aluminium</FooterLink>
            <FooterLink href="/categories/material-printed-phenolic">Printed Phenolic</FooterLink>
            <FooterLink href="/categories/digits-3">3 Digit</FooterLink>
            <FooterLink href="/categories/palindrome">Palindromes</FooterLink>
          </FooterColumn>
          <FooterColumn title="Activity">
            <FooterLink href="/activity">Recent sales</FooterLink>
            <FooterLink href="/activity?type=offer">Offers</FooterLink>
          </FooterColumn>
          <FooterColumn title="Ecosystem">
            <FooterLink href="https://opensea.io" external>OpenSea</FooterLink>
            <FooterLink href={CHAIN_DISPLAY.explorerUrl} external>
              Robinhood explorer
            </FooterLink>
          </FooterColumn>
        </div>
      </PageContainer>

      <div className="border-t border-[var(--color-border-subtle)]">
        <PageContainer size="cinematic" className="flex flex-col gap-2 py-5 text-xs text-[var(--color-text-tertiary)] md:flex-row md:items-center">
          <span>&copy; {new Date().getFullYear()} Net Vision. Non-custodial.</span>
          <span className="md:ml-auto">
            Button Presser on Robinhood Chain.
          </span>
        </PageContainer>
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