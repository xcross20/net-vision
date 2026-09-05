import { Storefront } from '@phosphor-icons/react/dist/ssr';

export function MarketplaceBadge({
  source = 'opensea',
  size = 'sm',
}: {
  source?: 'opensea' | 'x2y2' | 'blur';
  size?: 'sm' | 'md';
}) {
  const label =
    source === 'opensea' ? 'OpenSea' :
    source === 'x2y2' ? 'X2Y2' :
    source === 'blur' ? 'Blur' :
    'Market';
  const pad = size === 'md' ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
  const icon = size === 'md' ? 11 : 10;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-2)_70%,transparent)] text-[var(--color-text-secondary)] ${pad}`}>
      <Storefront size={icon} weight="duotone" />
      {label}
    </span>
  );
}