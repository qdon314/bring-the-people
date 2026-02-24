import type { ReviewStatus } from '@/lib/types'

const STATUS_STYLES: Record<ReviewStatus, string> = {
  draft: 'bg-border text-text-muted',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
}

const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}
