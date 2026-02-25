'use client'
import { useState } from 'react'
import { ChannelBadge } from '@/components/shared/ChannelBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useJobPoller } from '@/lib/hooks/useJobPoller'
import type { Frame } from '@/lib/types'

interface Props {
  frames: Frame[]
  selected: Set<string>
  onToggle: (id: string) => void
  frameJobs: Record<string, string>
  disabled?: boolean
}

export function FramePickerPanel({ frames, selected, onToggle, frameJobs, disabled }: Props) {
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = frames.filter(f => {
    if (channelFilter !== 'all' && f.channel !== channelFilter) return false
    if (statusFilter === 'approved' && f.review_status !== 'approved') return false
    if (statusFilter === 'unapproved' && f.review_status === 'approved') return false
    return true
  })

  const channels = Array.from(new Set(frames.map(f => f.channel)))

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          disabled={disabled}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="all">All channels</option>
          {channels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          disabled={disabled}
          className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved only</option>
          <option value="unapproved">Unapproved</option>
        </select>
      </div>

      {/* Frame checkboxes */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-text-muted py-3">No frames match these filters.</p>
        )}
        {filtered.map(frame => {
          const jobId = frameJobs[frame.frame_id]
          return (
            <label key={frame.frame_id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
              selected.has(frame.frame_id) ? 'border-primary bg-primary-light' : 'border-border hover:bg-bg'
            }`}>
              <input
                type="checkbox"
                checked={selected.has(frame.frame_id)}
                onChange={() => onToggle(frame.frame_id)}
                disabled={disabled}
                className="mt-0.5 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ChannelBadge channel={frame.channel} />
                  <StatusBadge status={frame.review_status} />
                  {jobId && <JobStatusPill jobId={jobId} />}
                </div>
                <p className="text-sm font-medium mt-1 truncate">{frame.hypothesis}</p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function JobStatusPill({ jobId }: { jobId: string }) {
  const { data: job } = useJobPoller(jobId)
  if (!job) return null
  return <span className="text-xs font-medium text-accent">
    {job.status === 'running' ? '⟳ Generating…' :
     job.status === 'completed' ? '✓ Done' :
     job.status === 'failed' ? '✗ Failed' : '⏳ Queued'}
  </span>
}
