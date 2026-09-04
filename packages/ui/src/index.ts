/**
 * Net Vision shared UI tokens and primitives.
 *
 * The application must feel like a native module of the NetNet product
 * family. These tokens are the implementation defaults; the final UI
 * must cross-check the live app.netnet.capital production values and
 * update if the family changes.
 */

export const designTokens = {
  color: {
    bg: '#08110D',
    panel: '#101B15',
    panelElevated: '#14231B',
    green: '#74F0A7',
    greenStrong: '#35C97B',
    text: '#EAF5EE',
    muted: '#9FB6A8',
    border: '#294335',
    danger: '#FF6B6B',
    warning: '#E8C86A',
  },
  font: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '10px',
  },
} as const;

export type DesignTokens = typeof designTokens;

export function formatPrice(value: number | null | undefined, currency: string = 'ETH'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return `0 ${currency}`;
  if (value < 0.001) return `${value.toExponential(2)} ${currency}`;
  if (value < 1) return `${value.toFixed(4)} ${currency}`;
  return `${value.toFixed(3)} ${currency}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function formatRelativeTime(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - epochSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}
