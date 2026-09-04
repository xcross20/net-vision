/**
 * Public environment values for the wallet provider.
 *
 * The WalletConnect project id is the only public value that the
 * client needs; it is not a secret. If it is missing, the wallet
 * modal falls back to injected wallets only.
 */
'use client';

export function walletConnectProjectId(): string {
  if (typeof process === 'undefined') return '';
  return (
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    process.env.NEXT_PUBLIC_WC_PROJECT_ID ??
    ''
  );
}
