/**
 * Wallet provider for the Net Vision marketplace.
 *
 * Wires wagmi + react-query into the app. We deliberately keep this
 * minimal and avoid third-party modal libraries so the wallet UI
 * matches the rest of the application.
 *
 * The provider is client-only. The server never imports it. This keeps
 * the OpenSea API key server-side and prevents the provider's
 * initialization from running during SSR.
 */
'use client';

import { ReactNode, useState } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { robinhood } from '@/lib/wallet/robinhood';
import { walletConnectProjectId } from '@/lib/wallet/env';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [config] = useState(() =>
    createConfig({
      chains: [robinhood],
      connectors: [
        injected({ shimDisconnect: true }),
        ...(walletConnectProjectId()
          ? [walletConnect({ projectId: walletConnectProjectId() })]
          : []),
      ],
      transports: {
        [robinhood.id]: http(),
      },
      ssr: true,
    }),
  );
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
