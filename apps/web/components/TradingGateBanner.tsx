/**
 * Customer-facing notice used wherever a wallet action would appear.
 *
 * The underlying safety gates stay in place; the copy is intentionally
 * framed for the customer and avoids developer terminology.
 */
export function TradingGateNotice({ context }: { context: 'token' | 'category' | 'sweep' }) {
  const label =
    context === 'token'
      ? 'Trading is paused while we finish safety checks. Read-only browsing is enabled.'
      : context === 'sweep'
        ? 'Bulk purchases follow the same safety window as direct buys.'
        : 'Category-level purchases inherit the global safety window.';
  return (
    <div className="border border-[var(--nv-border)] rounded-md p-3 flex flex-col gap-1">
      <div className="text-[var(--nv-warning)] font-medium text-sm">Trading paused</div>
      <div className="text-xs text-[var(--nv-muted)]">{label}</div>
    </div>
  );
}
