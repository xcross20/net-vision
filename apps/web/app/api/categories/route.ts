import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/categories';
import { categoryResponse } from '@/lib/market/category-contract';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = await listCategories();
  return NextResponse.json({
    categories: categories.map(categoryResponse),
  });
}
