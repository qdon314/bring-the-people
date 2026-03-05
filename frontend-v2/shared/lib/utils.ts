type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, boolean | undefined | null>
  | ClassValue[]

/**
 * Merge class names, filtering out falsy values.
 * Supports strings, conditional objects ({ 'text-red': isError }), and arrays.
 * Lightweight alternative to clsx — no external dependency required.
 */
export function cn(...inputs: ClassValue[]): string {
  const parts: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (typeof input === 'string' || typeof input === 'number') {
      parts.push(String(input))
    } else if (Array.isArray(input)) {
      const inner = cn(...input)
      if (inner) parts.push(inner)
    } else if (typeof input === 'object') {
      for (const [key, val] of Object.entries(input)) {
        if (val) parts.push(key)
      }
    }
  }
  return parts.join(' ')
}
