import type { ReviewStatus } from '@/lib/types'

const STATUS_CONFIG: Record<ReviewStatus, { style: string; icon: string; label: string }> = {
  draft: { 
    style: 'bg-border/50 text-text-muted border border-border', 
    icon: '○', 
    label: 'Pending Review' 
  },
  approved: { 
    style: 'bg-success/15 text-success border border-success/30 shadow-sm', 
    icon: '✓', 
    label: 'Approved' 
  },
  rejected: { 
    style: 'bg-danger/15 text-danger border border-danger/30', 
    icon: '✕', 
    label: 'Rejected' 
  },
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${config.style}`}>
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}
