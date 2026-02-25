import { CopyButton } from '@/components/shared/CopyButton'
import type { Variant } from '@/lib/types'
import type { UTMBundle } from '@/lib/utils/utm'

export function CopyBlock({ variant, utm }: { variant: Variant; utm: UTMBundle }) {
  const text = [
    `HOOK: ${variant.hook}`,
    ``,
    `BODY: ${variant.body}`,
    ``,
    `CTA: ${variant.cta}`,
    utm.full_url ? `\nURL: ${utm.full_url}` : '',
  ].join('\n')

  return (
    <div className="bg-bg rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Copy Pack</h5>
        <CopyButton text={text} label="Copy all" />
      </div>
      <pre className="text-xs whitespace-pre-wrap text-text font-mono bg-surface rounded p-3">{text}</pre>
    </div>
  )
}
