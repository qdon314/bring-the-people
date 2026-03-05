import React from 'react'
import { cn } from '@/shared/lib/utils'

type ReviewStatus = 'pending' | 'approved' | 'rejected'
type JobStatus = 'queued' | 'running' | 'completed' | 'failed'
type ExperimentStatus = 'draft' | 'active' | 'awaiting_approval' | 'decided'

export type BadgeStatus = ReviewStatus | JobStatus | ExperimentStatus

const STATUS_CONFIG: Record<BadgeStatus, { label: string; className: string }> = {
  // Review statuses
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  // Job statuses
  queued: { label: 'Queued', className: 'bg-gray-100 text-gray-700' },
  running: { label: 'Running', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  // Experiment statuses
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-800' },
  awaiting_approval: { label: 'Awaiting Approval', className: 'bg-yellow-100 text-yellow-800' },
  decided: { label: 'Decided', className: 'bg-purple-100 text-purple-800' },
}

interface StatusBadgeProps {
  status: BadgeStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
