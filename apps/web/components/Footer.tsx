export function Footer() {
  return (
    <footer className="border-t border-[var(--nv-border)] bg-[var(--nv-panel)] mt-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-[var(--nv-muted)] flex flex-col md:flex-row gap-2 md:items-center">
        <span>Net Vision · Non-custodial market terminal.</span>
        <span className="md:ml-auto">Button Presser on Robinhood Chain.</span>
      </div>
    </footer>
  );
}
