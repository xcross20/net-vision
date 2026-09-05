/**
 * Tiny className utility. Avoids a `clsx`/`classnames` dependency
 * while still being readable and tree-shakeable.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}