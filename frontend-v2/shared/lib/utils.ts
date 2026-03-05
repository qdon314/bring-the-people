/**
 * Merge class names, filtering out falsy values.
 * Lightweight alternative to clsx — no external dependency required.
 */
export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(' ')
}
