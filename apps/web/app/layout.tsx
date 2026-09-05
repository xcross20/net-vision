import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TopNavigation } from '@/components/TopNavigation';
import { Footer } from '@/components/Footer';
import { CHAIN_DISPLAY } from '@net-vision/chain-config';
import { WalletProvider } from '@/lib/wallet/WalletProvider';

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

export const metadata: Metadata = {
  title: 'Net Vision — Button Presser Market Terminal',
  description:
    'Net Vision is a specialized marketplace and analytics terminal for collectible numbers on Robinhood Chain.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <WalletProvider>
          <div className="min-h-[100dvh] flex flex-col">
            <TopNavigation
              chainName={CHAIN_DISPLAY.name}
              chainShortName={CHAIN_DISPLAY.shortName}
              chainId={CHAIN_DISPLAY.id}
            />
            <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-8 py-8 md:py-12">
              {children}
            </main>
            <Footer />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}