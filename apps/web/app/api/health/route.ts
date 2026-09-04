import { NextResponse } from 'next/server';
import { BUTTON_PRESSER_COLLECTION, ROBINHOOD_CHAIN } from '@net-vision/chain-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '', 10) || ROBINHOOD_CHAIN.id;
  const contract =
    process.env.NEXT_PUBLIC_COLLECTION_CONTRACT ?? BUTTON_PRESSER_COLLECTION.contractAddress;
  return NextResponse.json({
    status: 'ok',
    tradingEnabled: process.env.NEXT_PUBLIC_TRADING_ENABLED === 'true',
    chain: {
      id: chainId,
      contract,
    },
    time: new Date().toISOString(),
  });
}
