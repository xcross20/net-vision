import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/ui/Footer';
import { MarketHeaderClient } from '@/components/ui/MarketHeaderClient';
import { PageContainer } from '@/components/shell/PageContainer';
import { CartDrawer, CartProvider } from '@/components/cart';
import { WatchlistProvider } from '@/lib/watchlist/WatchlistProvider';
import { WalletProvider } from '@/lib/wallet/WalletProvider';
import { WalletConnectProvider } from '@/lib/wallet/WalletConnectProvider';
import { NetworkGateProvider } from '@/lib/wallet/NetworkGateProvider';

const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
  weight: ['400', '500', '600'],
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Net Vision — Button Presser Market Terminal',
  description:
    'A non-custodial market terminal for collectible numbers on Robinhood Chain. Browse every active listing, dig into trait categories, and trade from your wallet.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <WalletProvider>
          <WalletConnectProvider>
          <NetworkGateProvider>
          <WatchlistProvider>
          <CartProvider>
            <div className="flex min-h-[100dvh] flex-col">
              <MarketHeaderClient />
              <main className="flex-1">
                <PageContainer size="wide" className="pb-16 pt-10 md:pb-24 md:pt-16">
                  {children}
                </PageContainer>
              </main>
              <Footer />
            </div>
            <CartDrawer />
          </CartProvider>
          </WatchlistProvider>
          </NetworkGateProvider>
          </WalletConnectProvider>
        </WalletProvider>
      </body>
    </html>
  );
}


