import { NextResponse } from 'next/server';
import { metadataCoverage } from '@/lib/index/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(metadataCoverage());
}
