/**
 * TradingGateBanner: shown anywhere a wallet action would appear.
 *
 * Until the transaction-policy adversarial suite passes and live
 * OpenSea endpoint validation is complete, this banner is the only
 * thing rendered above the fold in place of Buy / Make Offer / List
 * buttons. Trading is OFF.
 */
export function TradingGateBanner({ context }: { context: 'token' | 'category' | 'sweep' }) {
  const label =
    context === 'token'
      ? 'Live trading is paused while the transaction-policy adversarial suite runs. Read-only browsing is enabled.'
      : context === 'sweep'
        ? 'Sweep is gated behind the same safety suite as direct buy.'
        : 'Category-level trade actions inherit the global trading flag.';
  return (
    <div className="nv-danger-banner flex flex-col gap-1">
      <div className="text-[var(--nv-danger)] font-semibold">Trading disabled</div>
      <div className="text-[var(--nv-muted)]">{label}</div>
    </div>
  );
}
