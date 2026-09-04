import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="nv-panel p-8 flex flex-col gap-3 items-start">
      <span className="nv-section-title">404</span>
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-[var(--nv-muted)]">
        That page is not part of Net Vision.
      </p>
      <Link href="/" className="nv-link">Return home →</Link>
    </div>
  );
}
