/**
 * Display formatters for the Net Vision market UI.
 *
 * `eth()` keeps the project's existing convention (`{value} ETH`) for
 * grid/list rows. `usd()` formats a USDG-style display price. `compact`
 * collapses large counts (`62,093`, `1.2M`). `pct` formats a signed
 * fractional move with one decimal and an explicit sign.
 */

export function eth(value: number | null | undefined, fallback = '\u2014'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  if (value === 0) return '0 ETH';
  if (value < 0.001) return `${value.toExponential(2)} ETH`;
  if (value < 1) return `${value.toFixed(4)} ETH`;
  return `${value.toFixed(3)} ETH`;
}

export function usd(value: number | null | undefined, currency = 'USDG', fallback = '\u2014'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  if (value === 0) return `0 ${currency}`;
  if (value < 1) return `${value.toFixed(2)} ${currency}`;
  return `${value.toFixed(2)} ${currency}`;
}

export function compact(value: number | null | undefined, fallback = '\u2014'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US');
}

export function pct(value: number | null | undefined, fallback = '\u2014'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function address(addr: string | null | undefined): string {
  if (!addr || addr.length < 12) return addr ?? '\u2014';
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

export function relative(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return '\u2014';
  const diff = Math.floor(Date.now() / 1000 - epochSeconds);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}