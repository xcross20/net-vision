import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/ui/Footer';
import { MarketHeaderClient } from '@/components/ui/MarketHeaderClient';
import { listCategories } from '@/lib/data/categories';
import { listTokens } from '@/lib/data/tokens';
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
    'A non-custodial market terminal for collectible numbers on Robinhood Chain. Browse every active listing, dig into trait categories, and trade from your wallet.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <WalletProvider>
          <div className="flex min-h-[100dvh] flex-col">
            <Shell />
            <main className="flex-1">
              <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
                {children}
              </div>
            </main>
            <Footer />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}

async function Shell() {
  const [tokens, categories] = await Promise.all([
    listTokens({ listedOnly: true, limit: 24 }),
    listCategories(),
  ]);
  return <MarketHeaderClient tokens={tokens} categories={categories} />;
}
