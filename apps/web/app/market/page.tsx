import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { MarketView } from '@/components/ui/MarketView';
import { CinematicHero, ShowroomAside } from '@/components/showroom/CinematicHero';
import { SHOWROOM_MEDIA } from '@/lib/brand/media';
import { compact, payment } from '@/lib/format';
import { Cube, ListBullets, Tag, Users } from '@phosphor-icons/react/dist/ssr';
import { getMarketSource } from '@/lib/market';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Market — Net Vision',
  description: 'Every active Button Presser listing on Robinhood Chain.',
};

export default async function MarketPage() {
  const source = getMarketSource();
  const [page, snapshot, freshness] = await Promise.all([
    source.listTokens({ listedOnly: true, limit: 60 }),
    source.getCollectionSnapshot(),
    source.getFreshness(),
  ]);
  const tokens = page.tokens;
  const listedCount = snapshot.listedCount;
  const syncing = snapshot.marketStatus === 'syncing';
  const live = snapshot.marketStatus === 'live' && freshness.fresh;

  return (
    <div className="flex flex-col gap-8">
      <CinematicHero
        imageSrc={SHOWROOM_MEDIA.homepageHero}
        imageAlt="Cinematic Button Presser plaques staged in a showroom environment"
        eyebrow="Market"
        title="Button Presser"
        kicker={
          <span className="inline-flex items-center gap-2">
            <LiveIndicator tone={live ? 'green' : 'amber'} size={6} label={live ? 'Live' : 'Syncing'} />
          </span>
        }
        body={
          listedCount === 0
            ? 'Verified listings are still syncing. Unknown tokens are not treated as unlisted.'
            : syncing
              ? 'Known verified asks from the worker index. Coverage is still below live threshold - this is not a complete book.'
              : 'Active verified asks on Button Presser. Connect a wallet to buy or make an offer.'
        }
        actions={
          <>
            <Link href="/categories" className="nv-button">
              Filter by category
              <ArrowRight size={14} weight="bold" />
            </Link>
            <Link href="/activity" className="nv-button nv-button-ghost">
              Recent activity
            </Link>
          </>
        }
        aside={<ShowroomAside lines={['Real numbers.', 'Real brass.', 'Real owners.']} />}
        metrics={[
          { label: 'Items', value: compact(snapshot.totalSupply), icon: <Cube size={16} weight="duotone" /> },
          {
            label: 'Floor',
            value: payment(snapshot.floorPrice, snapshot.currency),
            icon: <Tag size={16} weight="duotone" />,
            emphasis: true,
          },
          {
            label: syncing ? 'Known listed' : 'Listed',
            value: listedCount.toLocaleString(),
            icon: <ListBullets size={16} weight="duotone" />,
          },
          { label: 'Owners', value: compact(snapshot.owners), icon: <Users size={16} weight="duotone" /> },
        ]}
      />

      <MarketView tokens={tokens} categories={[]} />
    </div>
  );
}
