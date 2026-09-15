'use client';

import { cn } from '@/lib/cn';

type StockTicker = 'AAPL' | 'NVDA' | 'TSLA' | 'COIN' | 'MSFT' | 'SPY' | 'GOOGL' | 'AMZN' | 'SPCX';

const TICKER_STYLE: Record<
  StockTicker,
  { bg: string; fg: string; label: string; sub?: string }
> = {
  AAPL:  { bg: '#0b0b0b', fg: '#ffffff', label: '' },
  NVDA:  { bg: '#76b900', fg: '#0a1a04', label: '' },
  TSLA:  { bg: '#cc0000', fg: '#ffffff', label: '' },
  COIN:  { bg: '#0052ff', fg: '#ffffff', label: '' },
  MSFT:  { bg: '#ffffff', fg: '#1a1a1a', label: '', sub: 'quad' },
  SPY:   { bg: '#b30000', fg: '#ffffff', label: '' },
  GOOGL: { bg: '#ffffff', fg: '#1a1a1a', label: '', sub: 'g' },
  AMZN:  { bg: '#ff9900', fg: '#0b0b0b', label: '' },
  SPCX:  { bg: '#7a0019', fg: '#ffffff', label: '' },
};

/**
 * Honest placeholder for stock-token identity. Real Robinhood Token logos are
 * not yet bundled; this glyph is a recognisable, color-coded chip keyed off
 * the ticker. It is not used for commerce decisioning.
 */
export function StockTickerGlyph({
  ticker,
  size = 36,
  className,
}: {
  ticker: StockTicker;
  size?: number;
  className?: string;
}) {
  const style = TICKER_STYLE[ticker];
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: style.bg, color: style.fg }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        className,
      )}
    >
      {style.sub === 'quad' ? <MsftQuad size={size} /> : null}
      {style.sub === 'g' ? <GoogleG size={size} /> : null}
      {!style.sub ? <span style={{ fontSize: Math.round(size * 0.42) }}>{ticker[0]}</span> : null}
    </span>
  );
}

function MsftQuad({ size }: { size: number }) {
  const s = Math.round(size * 0.16);
  const cells: Array<{ bg: string }> = [
    { bg: '#f25022' },
    { bg: '#7fba00' },
    { bg: '#00a4ef' },
    { bg: '#ffb900' },
  ];
  return (
    <span
      aria-hidden="true"
      className="grid"
      style={{ width: size * 0.62, height: size * 0.62, gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: s * 0.35 }}
    >
      {cells.map((c) => (
        <span key={c.bg} style={{ backgroundColor: c.bg, borderRadius: s * 0.4 }} />
      ))}
    </span>
  );
}

function GoogleG({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center font-bold"
      style={{ fontSize: Math.round(size * 0.46) }}
    >
      <span style={{ color: '#4285F4' }}>G</span>
    </span>
  );
}

export const STOCK_TICKER_IDS = [
  'AAPL',
  'NVDA',
  'TSLA',
  'COIN',
  'MSFT',
  'SPY',
  'GOOGL',
  'AMZN',
  'SPCX',
] as const;
