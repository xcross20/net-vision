import Link from 'next/link';

export function TopNavigation(props: { chainName: string; chainShortName: string; chainId: number }) {
  return (
    <header className="border-b border-[var(--nv-border)] bg-[var(--nv-panel)]">
      <div className="mx-auto w-full max-w-7xl px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-[var(--nv-green)]">⬢</span>
          <span>Net Vision</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-sm text-[var(--nv-muted)]">
          <Link href="/" className="hover:text-[var(--nv-text)]">Overview</Link>
          <Link href="/categories" className="hover:text-[var(--nv-text)]">Categories</Link>
          <Link href="/tokens" className="hover:text-[var(--nv-text)]">Tokens</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span
            className="nv-chip nv-chip-strong"
            title={`${props.chainName} (chain ID ${props.chainId})`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--nv-green)]" />
            {props.chainShortName}
          </span>
        </div>
      </div>
    </header>
  );
}
