import { CopyButton } from '@/components/shared/CopyButton'
import type { UTMBundle } from '@/lib/utils/utm'

export function UTMPreview({ utm, adSetName }: { utm: UTMBundle; adSetName: string }) {
  return (
    <div className="bg-bg rounded-lg p-4 space-y-3">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">UTM Parameters</h5>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {Object.entries(utm).filter(([k]) => k !== 'full_url').map(([k, v]) => (
          <div key={k}>
            <span className="text-text-muted">{k}</span>
            <br />
            <span className="text-text">{String(v)}</span>
          </div>
        ))}
      </div>
      {utm.full_url && (
        <div>
          <p className="text-xs text-text-muted mb-1">Full URL</p>
          <div className="flex items-start gap-2">
            <code className="text-xs bg-surface px-2 py-1 rounded break-all flex-1">{utm.full_url}</code>
            <CopyButton text={utm.full_url} />
          </div>
        </div>
      )}
      {adSetName && (
        <div>
          <p className="text-xs text-text-muted mb-1">Ad set name</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-surface px-2 py-1 rounded flex-1">{adSetName}</code>
            <CopyButton text={adSetName} />
          </div>
        </div>
      )}
    </div>
  )
}
