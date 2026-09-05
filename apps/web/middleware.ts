import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Site-wide security headers for a wallet-facing app.
 * XSS / clickjacking protections are financial controls here.
 */
export function middleware(_request: NextRequest) {
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
