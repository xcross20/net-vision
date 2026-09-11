/**
 * Primary application navigation. Parked product (Gacha, Gear as a
 * top-level tab, Rewards) must not appear here until enabled.
 */
export const PRIMARY_NAV = [
  { href: '/market', label: 'Market' },
  { href: '/categories', label: 'Categories' },
  { href: '/activity', label: 'Activity' },
  { href: '/portfolio', label: 'Portfolio' },
] as const;

export type PrimaryNavItem = (typeof PRIMARY_NAV)[number];
