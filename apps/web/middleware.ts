import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 40;
const RATE_LIMIT_PREFIXES = ['/api/trade', '/api/v1/account', '/api/categories', '/api/v1/tokens'];

const hits = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rateLimited(request: NextRequest): boolean {
  const path = request.nextUrl.pathname;
  if (!RATE_LIMIT_PREFIXES.some((p) => path.startsWith(p))) return false;
  const key = `${clientKey(request)}:${RATE_LIMIT_PREFIXES.find((p) => path.startsWith(p))}`;
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now >= row.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  row.count += 1;
  return row.count > RATE_LIMIT_MAX;
}

/**
 * Site-wide security headers for a wallet-facing app.
 * XSS / clickjacking protections are financial controls here.
 */
const MAX_BODY_BYTES = 64 * 1024;

export function middleware(request: NextRequest) {
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return new NextResponse(JSON.stringify({ error: 'payload_too_large' }), {
        status: 413,
        headers: { 'content-type': 'application/json' },
      });
    }
  }
  if (rateLimited(request)) {
    return new NextResponse(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '60' },
    });
  }
  const response = NextResponse.next();

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://raw2.seadn.io https://i.seadn.io https://opensea.io",
    "font-src 'self' data:",
    // Next.js + wallet connectors still require limited inline/eval in practice;
    // tighten further once wagmi bundles are audited for nonce-based CSP.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://api.opensea.io wss://stream-api.opensea.io https://*.walletconnect.com wss://*.walletconnect.com https://rpc.robinhood.com https://*.railway.app",
    "worker-src 'self' blob:",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
