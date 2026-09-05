import { cn } from '@/lib/cn';
import { Sparkle } from '@phosphor-icons/react/dist/ssr';

/**
 * Composed empty state. Avoids raw engineering language. Use the
 * `cause` prop sparingly to hint at data flow without showing internals.
 */
export function EmptyState({
  title,
  body,
  action,
  tone = 'muted',
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  tone?: 'muted' | 'live' | 'warming';
  className?: string;
}) {
  const accent =
    tone === 'live' ? 'text-[var(--color-net-green)]' :
    tone === 'warming' ? 'text-[var(--color-warning)]' :
    'text-[var(--color-text-secondary)]';

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-10 text-center md:gap-4 md:px-10 md:py-14',
        className,
      )}
    >
      <div className={cn('inline-flex items-center gap-1.5 text-eyebrow', accent)}>
        <Sparkle size={12} weight="duotone" />
        {tone === 'warming' ? 'Live data coming' : tone === 'live' ? 'Watching' : 'Nothing yet'}
      </div>
      <h3 className="text-display text-2xl text-[var(--color-text-primary)] md:text-3xl">
        {title}
      </h3>
      {body ? (
        <p className="text-body max-w-[55ch] text-[var(--color-text-secondary)]">{body}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}