import { PortfolioView } from '@/components/portfolio/PortfolioView';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Portfolio — Net Vision',
  description: 'Your Button Presser inventory, listings, offers, and watchlist.',
};

export default function PortfolioPage() {
  return <PortfolioView />;
}
