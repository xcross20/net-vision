'use client';

import { Tabs } from '@/components/ui/Tabs';

export type CategoryTab = 'listings' | 'sales' | 'offers' | 'analytics';

export function CategoryTabs({
  value,
  onChange,
  listedCount,
}: {
  value: CategoryTab;
  onChange: (value: CategoryTab) => void;
  listedCount: number;
}) {
  return (
    <Tabs
      value={value}
      onChange={(next) => onChange(next as CategoryTab)}
      tabs={[
        { value: 'listings', label: 'Listings', count: listedCount },
        { value: 'sales', label: 'Sales' },
        { value: 'offers', label: 'Offers' },
        { value: 'analytics', label: 'Analytics' },
      ]}
    />
  );
}
