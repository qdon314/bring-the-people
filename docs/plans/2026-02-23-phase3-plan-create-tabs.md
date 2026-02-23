# Phase 3: Plan Tab + Create Tab Implementation Plan

Covers Steps 6–7 from the build order: the Strategy (Plan) tab and the Creative (Create) tab.

**Parent design**: [`docs/plans/2026-02-23-phase3-dashboard.md`](2026-02-23-phase3-dashboard.md)
**Prerequisite**: [`docs/plans/2026-02-23-phase3-frontend-scaffold.md`](2026-02-23-phase3-frontend-scaffold.md) (scaffold + Show shell complete)
**Backend required**: Tasks 1–4 from [`docs/plans/2026-02-23-phase3-backend-impl.md`](2026-02-23-phase3-backend-impl.md) (cycles, segments/frames/variants + review status, async job system)

---

## Task 15: AgentRunButton Component

This is the shared foundation for all three agent triggers. Build it first before either tab.

**File**: [`frontend/components/shared/AgentRunButton.tsx`](../../frontend/components/shared/AgentRunButton.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useJobPoller } from '@/lib/hooks/useJobPoller'
import type { BackgroundJob } from '@/lib/types'

interface AgentRunButtonProps {
  label: string
  onRun: () => Promise<{ job_id: string }>
  onComplete?: (job: BackgroundJob) => void
  disabled?: boolean
  lastRunSummary?: string
  lastRunAt?: string
}

type State = 'idle' | 'starting' | 'polling' | 'done' | 'error'

export function AgentRunButton({
  label, onRun, onComplete, disabled, lastRunSummary, lastRunAt
}: AgentRunButtonProps) {
  const [state, setState] = useState<State>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: job } = useJobPoller(state === 'polling' ? jobId : null)

  // React to job status changes
  if (job && state === 'polling') {
    if (job.status === 'completed') {
      setState('done')
      onComplete?.(job)
    } else if (job.status === 'failed') {
      setState('error')
      setErrorMsg(job.error_message ?? 'Agent run failed')
    }
  }

  async function handleRun() {
    setState('starting')
    setErrorMsg(null)
    try {
      const { job_id } = await onRun()
      setJobId(job_id)
      setState('polling')
    } catch (e: unknown) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start agent')
    }
  }

  const isRunning = state === 'starting' || state === 'polling'

  return (
    <div className="space-y-3">
      {/* Main button */}
      <button
        onClick={handleRun}
        disabled={disabled || isRunning}
        className="btn-primary inline-flex items-center gap-2"
      >
        {isRunning && <SpinnerIcon className="w-4 h-4 animate-spin" />}
        {state === 'starting' ? 'Starting…' :
         state === 'polling' ? `Running… (attempt ${job?.attempt_count ?? 1})` :
         label}
      </button>

      {/* Status line */}
      {state === 'polling' && job && (
        <p className="text-xs text-text-muted">
          Last updated {timeSince(job.updated_at)}
        </p>
      )}

      {/* Error */}
      {state === 'error' && errorMsg && (
        <div className="rounded-lg bg-danger-light p-3 flex items-center justify-between">
          <p className="text-sm text-danger">{errorMsg}</p>
          <button onClick={handleRun} className="text-sm font-medium text-danger underline">
            Retry
          </button>
        </div>
      )}

      {/* Success summary */}
      {state === 'done' && job?.result_json && (
        <details className="rounded-lg bg-success-light p-3">
          <summary className="text-sm font-medium text-success cursor-pointer">
            ✓ Complete — {job.result_json.reasoning_summary?.toString().slice(0, 80)}…
          </summary>
          <div className="mt-2 text-xs text-text-muted space-y-1">
            <p>Turns used: {String(job.result_json.turns_used ?? '—')}</p>
            <p>Run ID: <code className="font-mono">{String(job.result_json.run_id ?? '—')}</code></p>
          </div>
        </details>
      )}

      {/* Previous run info (when idle) */}
      {state === 'idle' && lastRunSummary && (
        <p className="text-xs text-text-muted">
          Last run: {lastRunSummary} · {lastRunAt && timeSince(lastRunAt)}
        </p>
      )}
    </div>
  )
}
```

**Supporting utility** in [`frontend/lib/utils/dates.ts`](../../frontend/lib/utils/dates.ts):
```ts
export function timeSince(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}
```

---

## Task 16: Plan Tab — Strategy Page

**File**: [`frontend/app/shows/[show_id]/plan/page.tsx`](../../frontend/app/shows/[show_id]/plan/page.tsx)

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { strategyApi } from '@/lib/api/strategy'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useCycles } from '@/lib/hooks/useCycles'
import { AgentRunButton } from '@/components/shared/AgentRunButton'
import { SegmentCard } from '@/components/strategy/SegmentCard'
import { FrameCard } from '@/components/strategy/FrameCard'

export default function PlanPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()

  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id

  const { data: segments, isLoading: segLoading } = useSegments(show_id, currentCycleId)
  const { data: frames, isLoading: frameLoading } = useFrames(show_id, currentCycleId)

  function onStrategyComplete() {
    // Invalidate segments and frames to reload with new cycle data
    qc.invalidateQueries({ queryKey: ['cycles', show_id] })
    qc.invalidateQueries({ queryKey: ['segments', show_id] })
    qc.invalidateQueries({ queryKey: ['frames', show_id] })
  }

  // Group frames by segment
  const framesBySegment = (frames ?? []).reduce<Record<string, typeof frames>>((acc, frame) => {
    acc[frame.segment_id] = [...(acc[frame.segment_id] ?? []), frame]
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

      {/* Strategy Run Panel */}
      <section aria-labelledby="strategy-heading">
        <div className="bg-surface border border-border rounded-lg p-6">
          <h3 id="strategy-heading" className="font-semibold text-lg mb-1">Strategy Agent</h3>
          <p className="text-sm text-text-muted mb-4">
            Analyzes the show and proposes 3–5 audience segments and framing hypotheses.
          </p>
          <AgentRunButton
            label="Run Strategy Agent"
            onRun={() => strategyApi.run(show_id)}
            onComplete={onStrategyComplete}
          />
        </div>
      </section>

      {/* Segments */}
      {(segLoading || (segments && segments.length > 0)) && (
        <section aria-labelledby="segments-heading">
          <div className="flex items-center justify-between mb-4">
            <h3 id="segments-heading" className="font-semibold text-lg">Audience Segments</h3>
            <span className="text-sm text-text-muted">
              {segments?.filter(s => s.review_status === 'approved').length ?? 0} approved
            </span>
          </div>
          {segLoading ? (
            <SegmentsSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {segments!.map(segment => (
                <SegmentCard
                  key={segment.segment_id}
                  segment={segment}
                  onReviewed={() => qc.invalidateQueries({ queryKey: ['segments', show_id] })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Frames (grouped by segment) */}
      {(frameLoading || (frames && frames.length > 0)) && (
        <section aria-labelledby="frames-heading">
          <div className="flex items-center justify-between mb-4">
            <h3 id="frames-heading" className="font-semibold text-lg">Creative Frames</h3>
            <span className="text-sm text-text-muted">
              {frames?.filter(f => f.review_status === 'approved').length ?? 0} approved
            </span>
          </div>
          {frameLoading ? (
            <FramesSkeleton />
          ) : (
            <div className="space-y-6">
              {(segments ?? []).map(segment => (
                <div key={segment.segment_id}>
                  <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                    {segment.name}
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(framesBySegment[segment.segment_id] ?? []).map(frame => (
                      <FrameCard
                        key={frame.frame_id}
                        frame={frame}
                        onReviewed={() => qc.invalidateQueries({ queryKey: ['frames', show_id] })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {!segLoading && !segments?.length && (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg font-medium mb-2">No strategy yet</p>
          <p className="text-sm">Run the Strategy Agent to propose audience segments and frames.</p>
        </div>
      )}

    </div>
  )
}
```

---

## Task 17: SegmentCard Component

**File**: [`frontend/components/strategy/SegmentCard.tsx`](../../frontend/components/strategy/SegmentCard.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { segmentsApi } from '@/lib/api/segments'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SegmentEditorModal } from './SegmentEditorModal'
import type { Segment } from '@/lib/types'

interface SegmentCardProps {
  segment: Segment
  onReviewed: () => void
}

export function SegmentCard({ segment, onReviewed }: SegmentCardProps) {
  const [editOpen, setEditOpen] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      segmentsApi.review(segment.segment_id, { action, reviewed_by: 'producer' }),
    onSuccess: onReviewed,
  })

  const def = segment.definition_json

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold">{segment.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded bg-bg text-text-muted font-medium">
              {segment.created_by === 'agent' ? '🤖 Agent' : '✏️ Human'}
            </span>
            <StatusBadge status={segment.review_status as any} />
          </div>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="text-xs text-primary hover:underline"
        >
          Edit
        </button>
      </div>

      {/* Definition summary */}
      <div className="text-sm text-text-muted space-y-1 mb-4">
        {def.geo && <p>📍 {String(def.geo)}</p>}
        {def.age_range && <p>👥 Age {String(def.age_range)}</p>}
        {def.interests && Array.isArray(def.interests) && (
          <p>🎯 {(def.interests as string[]).slice(0, 3).join(', ')}</p>
        )}
        {segment.estimated_size && (
          <p>~{segment.estimated_size.toLocaleString()} people</p>
        )}
      </div>

      {/* Actions */}
      {segment.review_status !== 'approved' && (
        <div className="flex gap-2">
          <button
            onClick={() => reviewMutation.mutate('approve')}
            disabled={reviewMutation.isPending}
            className="flex-1 btn-success text-sm py-1.5"
          >
            Approve
          </button>
          <button
            onClick={() => reviewMutation.mutate('reject')}
            disabled={reviewMutation.isPending}
            className="flex-1 btn-ghost text-sm py-1.5"
          >
            Reject
          </button>
        </div>
      )}
      {segment.review_status === 'approved' && (
        <button
          onClick={() => reviewMutation.mutate('reject')}
          className="text-xs text-text-muted hover:text-danger"
        >
          Undo approval
        </button>
      )}

      {reviewMutation.error && (
        <p className="text-xs text-danger mt-2">{reviewMutation.error.message}</p>
      )}

      <SegmentEditorModal
        segment={segment}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onReviewed}
      />
    </div>
  )
}
```

---

## Task 18: FrameCard Component

**File**: [`frontend/components/strategy/FrameCard.tsx`](../../frontend/components/strategy/FrameCard.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { framesApi } from '@/lib/api/frames'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FrameEditorModal } from './FrameEditorModal'
import type { Frame } from '@/lib/types'

interface FrameCardProps {
  frame: Frame
  onReviewed: () => void
}

export function FrameCard({ frame, onReviewed }: FrameCardProps) {
  const { show_id } = useParams<{ show_id: string }>()
  const [editOpen, setEditOpen] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      framesApi.review(frame.frame_id, { action, reviewed_by: 'producer' }),
    onSuccess: onReviewed,
  })

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <ChannelBadge channel={frame.channel} />
            <StatusBadge status={frame.review_status as any} />
          </div>
          <p className="font-semibold text-sm leading-snug">{frame.hypothesis}</p>
        </div>
        <button onClick={() => setEditOpen(true)} className="text-xs text-primary hover:underline shrink-0">
          Edit
        </button>
      </div>

      {/* Promise */}
      <blockquote className="text-sm text-text-muted italic border-l-2 border-primary/30 pl-3 mb-3">
        "{frame.promise}"
      </blockquote>

      {/* Evidence refs (collapsible) */}
      {frame.evidence_refs.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowEvidence(v => !v)}
            className="text-xs text-text-muted hover:text-text"
          >
            {showEvidence ? '▾' : '▸'} {frame.evidence_refs.length} evidence ref{frame.evidence_refs.length !== 1 ? 's' : ''}
          </button>
          {showEvidence && (
            <ul className="mt-2 space-y-1">
              {frame.evidence_refs.map((ref, i) => (
                <li key={i} className="text-xs text-text-muted bg-bg rounded px-2 py-1">
                  {String(ref.source ?? ref.description ?? JSON.stringify(ref))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Risk notes */}
      {frame.risk_notes && (
        <p className="text-xs text-warning mb-3">⚠️ {frame.risk_notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {frame.review_status !== 'approved' ? (
          <>
            <button
              onClick={() => reviewMutation.mutate('approve')}
              disabled={reviewMutation.isPending}
              className="btn-success text-xs py-1 px-3"
            >
              Approve
            </button>
            <button
              onClick={() => reviewMutation.mutate('reject')}
              disabled={reviewMutation.isPending}
              className="btn-ghost text-xs py-1 px-3"
            >
              Reject
            </button>
          </>
        ) : (
          <button onClick={() => reviewMutation.mutate('reject')} className="text-xs text-text-muted hover:text-danger">
            Undo approval
          </button>
        )}
        <Link
          href={`/shows/${show_id}/create?frame_id=${frame.frame_id}`}
          className="ml-auto text-xs text-primary font-medium hover:underline"
        >
          Generate Creative →
        </Link>
      </div>

      <FrameEditorModal frame={frame} open={editOpen} onClose={() => setEditOpen(false)} onSaved={onReviewed} />
    </div>
  )
}
```

`ChannelBadge`:
```tsx
const CHANNEL_COLORS: Record<string, string> = {
  meta: 'bg-accent-light text-accent',
  instagram: 'bg-primary-light text-primary',
  tiktok: 'bg-bg text-text-muted',
  reddit: 'bg-warning-light text-warning',
  email: 'bg-success-light text-success',
}

function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[channel] ?? 'bg-bg text-text-muted'}`}>
      {channel.charAt(0).toUpperCase() + channel.slice(1)}
    </span>
  )
}
```

---

## Task 19: Segment + Frame Editor Modals

### SegmentEditorModal

**File**: [`frontend/components/strategy/SegmentEditorModal.tsx`](../../frontend/components/strategy/SegmentEditorModal.tsx)

Uses shadcn `Dialog`. Shows the `definition_json` as an editable JSON textarea. On save, calls `PATCH /api/segments/{id}` (need to add this endpoint — see below) with updated data.

```tsx
'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { segmentsApi } from '@/lib/api/segments'
import type { Segment } from '@/lib/types'

interface Props {
  segment: Segment
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function SegmentEditorModal({ segment, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(segment.name)
  const [defJson, setDefJson] = useState(JSON.stringify(segment.definition_json, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      let def: object
      try {
        def = JSON.parse(defJson)
        setJsonError(null)
      } catch {
        setJsonError('Invalid JSON')
        throw new Error('Invalid JSON')
      }
      return segmentsApi.update(segment.segment_id, { name, definition_json: def })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Segment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input w-full mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Definition (JSON)</label>
            <textarea
              value={defJson}
              onChange={e => setDefJson(e.target.value)}
              className="input w-full mt-1 font-mono text-xs"
              rows={8}
            />
            {jsonError && <p className="text-xs text-danger mt-1">{jsonError}</p>}
          </div>
          <p className="text-xs text-text-muted">
            ✏️ Editing marks this segment as human-authored.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary">
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Backend addition needed**: `PATCH /api/segments/{id}` and `PATCH /api/frames/{id}` for human edits. Add to [`src/growth/app/api/segments.py`](../../src/growth/app/api/segments.py) and [`src/growth/app/api/frames.py`](../../src/growth/app/api/frames.py). When a segment/frame is edited, set `created_by = "human"` to track provenance.

### FrameEditorModal

Same pattern as `SegmentEditorModal`. Editable fields: `hypothesis`, `promise`, `channel`, `risk_notes`. Evidence refs are read-only (they come from agent citations). Sets `created_by = "human"` on save.

---

## Task 20: Create Tab — Creative Page

**File**: [`frontend/app/shows/[show_id]/create/page.tsx`](../../frontend/app/shows/[show_id]/create/page.tsx)

```tsx
'use client'
import { useParams, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFrames } from '@/lib/hooks/useFrames'
import { useVariants } from '@/lib/hooks/useVariants'
import { useCycles } from '@/lib/hooks/useCycles'
import { creativeApi } from '@/lib/api/creative'
import { AgentRunButton } from '@/components/shared/AgentRunButton'
import { FramePickerPanel } from '@/components/creative/FramePickerPanel'
import { CreativeReviewPanel } from '@/components/creative/CreativeReviewPanel'

export default function CreatePage() {
  const { show_id } = useParams<{ show_id: string }>()
  const searchParams = useSearchParams()
  const preselectedFrameId = searchParams.get('frame_id')

  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id

  const { data: frames } = useFrames(show_id, currentCycleId)

  // Frame selection state — default to preselected if coming from Plan tab
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(
    preselectedFrameId ? new Set([preselectedFrameId]) : new Set()
  )

  // Track active jobs per frame
  const [frameJobs, setFrameJobs] = useState<Record<string, string>>({})  // frameId → jobId

  async function generateForSelected() {
    for (const frameId of selectedFrameIds) {
      const { job_id } = await creativeApi.run(frameId)
      setFrameJobs(prev => ({ ...prev, [frameId]: job_id }))
    }
  }

  function onVariantsGenerated(frameId: string) {
    qc.invalidateQueries({ queryKey: ['variants', frameId] })
  }

  if (!frames?.length) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 text-center text-text-muted">
        <p className="text-lg font-medium mb-2">No frames yet</p>
        <p className="text-sm">Run the Strategy Agent on the Plan tab first to propose frames.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

      {/* Frame picker + generate button */}
      <section aria-labelledby="frame-picker-heading">
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 id="frame-picker-heading" className="font-semibold text-lg">Generate Creative</h3>
              <p className="text-sm text-text-muted">Select frames to generate ad copy variants.</p>
            </div>
            {selectedFrameIds.size > 0 && (
              <button
                onClick={generateForSelected}
                className="btn-primary"
              >
                Generate Creative ({selectedFrameIds.size} frame{selectedFrameIds.size !== 1 ? 's' : ''})
              </button>
            )}
          </div>
          <FramePickerPanel
            frames={frames}
            selected={selectedFrameIds}
            onToggle={(id) => setSelectedFrameIds(prev => {
              const next = new Set(prev)
              next.has(id) ? next.delete(id) : next.add(id)
              return next
            })}
            frameJobs={frameJobs}
          />
        </div>
      </section>

      {/* Creative review (shown per frame that has variants or a running job) */}
      {frames.map(frame => {
        const hasJobOrVariants = frameJobs[frame.frame_id] || true  // show all frames with variants
        return hasJobOrVariants ? (
          <CreativeReviewPanel
            key={frame.frame_id}
            frame={frame}
            jobId={frameJobs[frame.frame_id] ?? null}
            onComplete={() => onVariantsGenerated(frame.frame_id)}
            onReviewed={() => qc.invalidateQueries({ queryKey: ['variants', frame.frame_id] })}
          />
        ) : null
      })}

    </div>
  )
}
```

---

## Task 21: FramePickerPanel Component

**File**: [`frontend/components/creative/FramePickerPanel.tsx`](../../frontend/components/creative/FramePickerPanel.tsx)

A filterable list of frames as checkboxes:

```tsx
import type { Frame } from '@/lib/types'

interface Props {
  frames: Frame[]
  selected: Set<string>
  onToggle: (id: string) => void
  frameJobs: Record<string, string>
}

export function FramePickerPanel({ frames, selected, onToggle, frameJobs }: Props) {
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = frames.filter(f => {
    if (channelFilter !== 'all' && f.channel !== channelFilter) return false
    if (statusFilter === 'approved' && f.review_status !== 'approved') return false
    if (statusFilter === 'unapproved' && f.review_status === 'approved') return false
    return true
  })

  const channels = [...new Set(frames.map(f => f.channel))]

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="select text-sm">
          <option value="all">All channels</option>
          {channels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select text-sm">
          <option value="all">All statuses</option>
          <option value="approved">Approved only</option>
          <option value="unapproved">Unapproved</option>
        </select>
      </div>

      {/* Frame checkboxes */}
      <div className="space-y-2">
        {filtered.map(frame => {
          const jobId = frameJobs[frame.frame_id]
          return (
            <label key={frame.frame_id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
              selected.has(frame.frame_id) ? 'border-primary bg-primary-light' : 'border-border hover:bg-bg'
            }`}>
              <input
                type="checkbox"
                checked={selected.has(frame.frame_id)}
                onChange={() => onToggle(frame.frame_id)}
                className="mt-0.5 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ChannelBadge channel={frame.channel} />
                  <StatusBadge status={frame.review_status as any} />
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
```

`JobStatusPill` shows the live job status using `useJobPoller(jobId)`:
```tsx
function JobStatusPill({ jobId }: { jobId: string }) {
  const { data: job } = useJobPoller(jobId)
  if (!job) return null
  return <span className="text-xs font-medium text-accent">
    {job.status === 'running' ? '⟳ Generating…' :
     job.status === 'completed' ? '✓ Done' :
     job.status === 'failed' ? '✗ Failed' : '⏳ Queued'}
  </span>
}
```

---

## Task 22: CreativeReviewPanel Component

**File**: [`frontend/components/creative/CreativeReviewPanel.tsx`](../../frontend/components/creative/CreativeReviewPanel.tsx)

```tsx
'use client'
import { useJobPoller } from '@/lib/hooks/useJobPoller'
import { useVariants } from '@/lib/hooks/useVariants'
import { VariantCard } from './VariantCard'
import type { Frame } from '@/lib/types'

interface Props {
  frame: Frame
  jobId: string | null
  onComplete: () => void
  onReviewed: () => void
}

export function CreativeReviewPanel({ frame, jobId, onComplete, onReviewed }: Props) {
  const { data: job } = useJobPoller(jobId)
  const { data: variants } = useVariants(frame.frame_id)

  // Trigger parent refresh when job completes
  useEffect(() => {
    if (job?.status === 'completed') onComplete()
  }, [job?.status])

  const isGenerating = job && (job.status === 'queued' || job.status === 'running')

  return (
    <section aria-labelledby={`frame-${frame.frame_id}-heading`}>
      <div className="bg-surface border border-border rounded-lg">
        {/* Frame header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ChannelBadge channel={frame.channel} />
            <h3 id={`frame-${frame.frame_id}-heading`} className="font-semibold">
              {frame.hypothesis.slice(0, 80)}{frame.hypothesis.length > 80 ? '…' : ''}
            </h3>
          </div>
          <p className="text-sm text-text-muted mt-1">"{frame.promise}"</p>
        </div>

        {/* Generation status */}
        {isGenerating && (
          <div className="p-4 flex items-center gap-3 text-sm text-accent bg-accent-light/30">
            <SpinnerIcon className="w-4 h-4 animate-spin" />
            Generating variants… {job.status === 'running' ? '(running)' : '(queued)'}
          </div>
        )}

        {/* Error */}
        {job?.status === 'failed' && (
          <div className="p-4 bg-danger-light text-danger text-sm">
            Generation failed: {job.error_message}
          </div>
        )}

        {/* Variants */}
        {variants && variants.length > 0 && (
          <div className="divide-y divide-border">
            {variants.map(variant => (
              <VariantCard key={variant.variant_id} variant={variant} onReviewed={onReviewed} />
            ))}
          </div>
        )}

        {/* Empty state after job complete */}
        {!isGenerating && job?.status !== 'failed' && !variants?.length && (
          <div className="p-5 text-sm text-text-muted">
            No variants yet. Select this frame and click Generate Creative.
          </div>
        )}
      </div>
    </section>
  )
}
```

---

## Task 23: VariantCard Component

**File**: [`frontend/components/creative/VariantCard.tsx`](../../frontend/components/creative/VariantCard.tsx)

```tsx
'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { variantsApi } from '@/lib/api/variants'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VariantEditorModal } from './VariantEditorModal'
import type { Variant } from '@/lib/types'

const PLATFORM_LIMITS: Record<string, { hook: number; body: number; cta: number }> = {
  meta:      { hook: 80,  body: 500, cta: 60 },
  instagram: { hook: 80,  body: 300, cta: 60 },
  tiktok:    { hook: 100, body: 300, cta: 60 },
  reddit:    { hook: 300, body: 1000, cta: 80 },
  email:     { hook: 200, body: 2000, cta: 80 },
}

export function VariantCard({ variant, onReviewed }: { variant: Variant; onReviewed: () => void }) {
  const [editOpen, setEditOpen] = useState(false)
  const limits = PLATFORM_LIMITS[variant.platform] ?? PLATFORM_LIMITS.meta

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      variantsApi.review(variant.variant_id, { action, reviewed_by: 'producer' }),
    onSuccess: onReviewed,
  })

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-bg px-1.5 py-0.5 rounded text-text-muted">
            {variant.variant_id.slice(0, 8)}
          </span>
          <StatusBadge status={variant.review_status as any} />
          {!variant.constraints_passed && (
            <span className="text-xs text-danger">⚠ Constraints</span>
          )}
        </div>
        <button onClick={() => setEditOpen(true)} className="text-xs text-primary hover:underline">
          Edit
        </button>
      </div>

      {/* Copy content */}
      <div className="space-y-3 mb-4">
        <CopyField label="Hook" value={variant.hook} limit={limits.hook} />
        <CopyField label="Body" value={variant.body} limit={limits.body} />
        <CopyField label="CTA" value={variant.cta} limit={limits.cta} />
      </div>

      {/* Constraints checklist */}
      <ConstraintsChecklist variant={variant} limits={limits} />

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        {variant.review_status !== 'approved' ? (
          <>
            <button
              onClick={() => reviewMutation.mutate('approve')}
              disabled={reviewMutation.isPending}
              className="btn-success text-xs py-1 px-3"
            >
              Approve
            </button>
            <button
              onClick={() => reviewMutation.mutate('reject')}
              disabled={reviewMutation.isPending}
              className="btn-ghost text-xs py-1 px-3"
            >
              Reject
            </button>
          </>
        ) : (
          <button onClick={() => reviewMutation.mutate('reject')} className="text-xs text-text-muted hover:text-danger">
            Undo approval
          </button>
        )}
      </div>

      <VariantEditorModal
        variant={variant}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onReviewed}
      />
    </div>
  )
}

function CopyField({ label, value, limit }: { label: string; value: string; limit: number }) {
  const over = value.length > limit
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-mono ${over ? 'text-danger' : 'text-text-muted'}`}>
          {value.length}/{limit}
        </span>
      </div>
      <p className={`text-sm ${over ? 'text-danger' : ''}`}>{value}</p>
    </div>
  )
}

function ConstraintsChecklist({ variant, limits }: { variant: Variant; limits: { hook: number; body: number; cta: number } }) {
  const checks = [
    { label: 'Hook within limit', pass: variant.hook.length <= limits.hook },
    { label: 'Body within limit', pass: variant.body.length <= limits.body },
    { label: 'CTA within limit', pass: variant.cta.length <= limits.cta },
    { label: 'Constraints passed', pass: variant.constraints_passed },
  ]
  return (
    <ul className="space-y-1">
      {checks.map(c => (
        <li key={c.label} className="flex items-center gap-2 text-xs text-text-muted">
          <span className={c.pass ? 'text-success' : 'text-danger'}>{c.pass ? '✓' : '✗'}</span>
          {c.label}
        </li>
      ))}
    </ul>
  )
}
```

---

## Task 24: VariantEditorModal

**File**: [`frontend/components/creative/VariantEditorModal.tsx`](../../frontend/components/creative/VariantEditorModal.tsx)

Same pattern as `SegmentEditorModal`. Editable fields: `hook`, `body`, `cta`. Shows character counts vs platform limits. On save, calls `PATCH /api/variants/{id}` (new backend endpoint needed) and sets `created_by = "human"`.

**Backend addition needed**: `PATCH /api/variants/{id}` — update hook/body/cta, set `created_by = "human"`.

---

## Summary: Files Created in This Plan

### Frontend
| File | Purpose |
|------|---------|
| `frontend/components/shared/AgentRunButton.tsx` | Shared async agent trigger + job poller UI |
| `frontend/app/shows/[show_id]/plan/page.tsx` | Plan tab page |
| `frontend/components/strategy/SegmentCard.tsx` | Segment display + review |
| `frontend/components/strategy/FrameCard.tsx` | Frame display + review |
| `frontend/components/strategy/SegmentEditorModal.tsx` | Segment editing modal |
| `frontend/components/strategy/FrameEditorModal.tsx` | Frame editing modal |
| `frontend/app/shows/[show_id]/create/page.tsx` | Create tab page |
| `frontend/components/creative/FramePickerPanel.tsx` | Frame multi-select with job status |
| `frontend/components/creative/CreativeReviewPanel.tsx` | Per-frame variant review section |
| `frontend/components/creative/VariantCard.tsx` | Variant display with char counts + review |
| `frontend/components/creative/VariantEditorModal.tsx` | Variant editing modal |

### Additional backend endpoints needed
| Endpoint | File | Note |
|----------|------|------|
| `PATCH /api/segments/{id}` | [`src/growth/app/api/segments.py`](../../src/growth/app/api/segments.py) | Sets `created_by="human"` |
| `PATCH /api/frames/{id}` | [`src/growth/app/api/frames.py`](../../src/growth/app/api/frames.py) | Sets `created_by="human"` |
| `PATCH /api/variants/{id}` | [`src/growth/app/api/variants.py`](../../src/growth/app/api/variants.py) | Sets `created_by="human"` |
