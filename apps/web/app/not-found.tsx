import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-5 py-16">
      <span className="text-eyebrow">404</span>
      <h1 className="text-display text-[clamp(2.5rem,5vw,4rem)] text-[var(--color-text-primary)]">
        Nothing at this address.
      </h1>
      <p className="text-body max-w-[52ch] text-[var(--color-text-secondary)]">
        That page is not part of Net Vision. Return to the homepage to keep exploring the
        Button Presser market.
      </p>
      <Link href="/" className="nv-button">
        Return home
        <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  );
}
