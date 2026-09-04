import Link from 'next/link';

export function TopNavigation(props: {
  chainName: string;
  chainShortName: string;
  chainId: number;
}) {
  return (
    <header className="border-b border-[var(--nv-border)] bg-[var(--nv-panel)]/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto w-full max-w-7xl px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-[var(--nv-green)]">⬢</span>
          <span>Net Vision</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm text-[var(--nv-muted)]">
          <Link href="/" className="hover:text-[var(--nv-text)]">
            Overview
          </Link>
          <Link href="/market" className="hover:text-[var(--nv-text)]">
            Market
          </Link>
          <Link href="/categories" className="hover:text-[var(--nv-text)]">
            Categories
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span
            className="nv-chip nv-chip-strong"
            title={`${props.chainName} (chain ID ${props.chainId})`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-green)]" />
            {props.chainShortName}
          </span>
          <button
            type="button"
            className="nv-button nv-button-ghost text-xs px-3 py-1.5"
            disabled
            aria-disabled="true"
          >
            Connect
          </button>
        </div>
      </div>
    </header>
  );
}
