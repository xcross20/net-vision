'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@/components/ConnectButton';
import { Hex } from '@/components/icons';
import { motion } from 'framer-motion';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/market', label: 'Market' },
  { href: '/categories', label: 'Categories' },
];

export function TopNavigation(props: {
  chainName: string;
  chainShortName: string;
  chainId: number;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--nv-border)] bg-[color-mix(in_srgb,var(--nv-bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-[var(--nv-text)]"
        >
          <motion.span
            initial={{ rotate: 0 }}
            whileHover={{ rotate: 30 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[rgba(116,240,167,0.08)] text-[var(--nv-green)]"
          >
            <Hex size={16} weight="duotone" />
          </motion.span>
          <span className="text-[15px]">Net Vision</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? 'rounded-md px-3 py-1.5 text-[var(--nv-text)]'
                    : 'rounded-md px-3 py-1.5 text-[var(--nv-muted)] transition-colors hover:text-[var(--nv-text)]'
                }
              >
                {active ? (
                  <span className="relative inline-flex">
                    {item.label}
                    <motion.span
                      layoutId="nav-active-underline"
                      className="absolute -bottom-1 left-0 right-0 h-px bg-[var(--nv-green)]"
                      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                    />
                  </span>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="nv-chip nv-chip-strong"
            title={`${props.chainName} (chain ID ${props.chainId})`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-green)]" />
            {props.chainShortName}
          </span>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}