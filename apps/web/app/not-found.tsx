import Link from 'next/link';
import { ArrowR } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="nv-panel-soft flex flex-col items-start gap-3 p-8">
      <span className="nv-eyebrow">404</span>
      <h1 className="nv-display text-3xl md:text-4xl">Not found</h1>
      <p className="nv-body">That page is not part of Net Vision.</p>
      <Link href="/" className="nv-link inline-flex items-center gap-1 text-sm">
        Return home
        <ArrowR size={12} weight="bold" />
      </Link>
    </div>
  );
}