import type { Metadata } from 'next';
import './globals.css';
import { TopNavigation } from '@/components/TopNavigation';
import { Footer } from '@/components/Footer';
import { CHAIN_DISPLAY } from '@net-vision/chain-config';

export const metadata: Metadata = {
  title: 'Net Vision — Button Presser Market Terminal',
  description:
    'Net Vision is a specialized marketplace and analytics terminal for collectible numbers on Robinhood Chain.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <TopNavigation
            chainName={CHAIN_DISPLAY.name}
            chainShortName={CHAIN_DISPLAY.shortName}
            chainId={CHAIN_DISPLAY.id}
          />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
