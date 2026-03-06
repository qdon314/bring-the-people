'use client'

import React, { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { Dialog } from '@/shared/ui/dialog'
import { showToast } from '@/shared/ui/toast'
import { useApproveFrame, useRejectFrame, useUndoFrameReview } from '../mutations'
import type { FrameResponse } from '../api'
import { useSegments } from '@/features/segments/queries'
import { FrameEditModal } from './FrameEditModal'

interface FrameCardProps {
  frame: FrameResponse
  showId: string
}

export function FrameCard({ frame, showId }: FrameCardProps) {
  const [riskNotesExpanded, setRiskNotesExpanded] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data: segments } = useSegments(showId)
  const segment = segments?.find((s) => s.segment_id === frame.segment_id)
  const segmentName = segment?.name ?? 'Unknown segment'

  const approveMutation = useApproveFrame(showId)
  const rejectMutation = useRejectFrame(showId)
  const undoMutation = useUndoFrameReview(showId)

  const isDecided = frame.review_status === 'approved' || frame.review_status === 'rejected'
  const isPending = frame.review_status === 'pending'

  function handleApprove() {
    approveMutation.mutate(
      { frameId: frame.frame_id },
      {
        onSuccess: () => showToast('Frame approved', 'success'),
        onError: () => showToast('Failed to approve frame. Try again or refresh the page.', 'error'),
      }
    )
  }

  function handleRejectConfirm() {
    rejectMutation.mutate(
      { frameId: frame.frame_id, notes: rejectReason },
      {
        onSuccess: () => {
          showToast('Frame rejected', 'success')
          setRejectDialogOpen(false)
          setRejectReason('')
        },
        onError: () => {
          showToast('Failed to reject frame. Try again or refresh the page.', 'error')
        },
      }
    )
  }

  function handleUndo() {
    undoMutation.mutate(
      { frameId: frame.frame_id },
      {
        onSuccess: () => showToast('Review undone', 'success'),
        onError: () => showToast('Failed to undo review. Try again.', 'error'),
      }
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-text">Frame</h3>
            <StatusBadge status={frame.review_status} />
          </div>

          <p className="mt-1 text-xs text-text-muted">Segment: {segmentName}</p>

          <div className="mt-2 space-y-1">
            <p className="text-xs">
              <span className="font-medium text-text-muted">Hypothesis:</span>{' '}
              <span className="text-text">{frame.hypothesis}</span>
            </p>
            <p className="text-xs">
              <span className="font-medium text-text-muted">Promise:</span>{' '}
              <span className="text-text">{frame.promise}</span>
            </p>
            <p className="text-xs">
              <span className="font-medium text-text-muted">Channel:</span>{' '}
              <span className="text-text">{frame.channel}</span>
            </p>
          </div>

          {frame.risk_notes && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setRiskNotesExpanded((v) => !v)}
                className="text-xs text-text-muted hover:text-text"
              >
                {riskNotesExpanded ? 'Hide risk notes' : 'Show risk notes'}
              </button>
              {riskNotesExpanded && (
                <p className="mt-1 text-xs text-text">{frame.risk_notes}</p>
              )}
            </div>
          )}

          {isDecided && frame.reviewed_by && (
            <p className="mt-2 text-xs text-text-muted">
              Reviewed by {frame.reviewed_by}
              {frame.reviewed_at && (
                <> &middot; {new Date(frame.reviewed_at).toLocaleDateString()}</>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPending && (
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg"
            >
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={handleApprove}
            disabled={isDecided || approveMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
              'bg-green-600 text-white hover:bg-green-700',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {approveMutation.isPending && <SpinnerIcon className="h-3 w-3" />}
            {approveMutation.isPending ? 'Approving\u2026' : 'Approve'}
          </button>

          <button
            type="button"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isDecided || rejectMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
              'bg-red-600 text-white hover:bg-red-700',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {rejectMutation.isPending && <SpinnerIcon className="h-3 w-3" />}
            {rejectMutation.isPending ? 'Rejecting\u2026' : 'Reject'}
          </button>

          {isDecided && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoMutation.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                'bg-gray-500 text-white hover:bg-gray-600',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {undoMutation.isPending && <SpinnerIcon className="h-3 w-3" />}
              {undoMutation.isPending ? 'Undoing\u2026' : 'Undo review'}
            </button>
          )}
        </div>
      </div>

      {/* Reject confirmation dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          setRejectDialogOpen(false)
          setRejectReason('')
        }}
        title="Reject frame"
      >
        <p className="text-sm text-text-muted">Are you sure you want to reject this frame?</p>
        <div className="mt-4">
          <label
            htmlFor={`reject-reason-${frame.frame_id}`}
            className="block text-xs font-medium text-text-muted"
          >
            Reason (optional)
          </label>
          <textarea
            id={`reject-reason-${frame.frame_id}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            placeholder="Enter reason…"
          />
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setRejectDialogOpen(false)
              setRejectReason('')
            }}
            disabled={rejectMutation.isPending}
            className="rounded-md px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRejectConfirm}
            disabled={rejectMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white',
              'hover:bg-red-700 disabled:opacity-50'
            )}
          >
            {rejectMutation.isPending && <SpinnerIcon className="h-4 w-4" />}
            {rejectMutation.isPending ? 'Rejecting\u2026' : 'Reject frame'}
          </button>
        </div>
      </Dialog>

      <FrameEditModal
        frame={frame}
        showId={showId}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
      />
    </div>
  )
}

export function FrameCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
          <div className="h-3 w-32 rounded bg-gray-200" />
          <div className="space-y-1">
            <div className="h-3 w-full rounded bg-gray-200" />
            <div className="h-3 w-3/4 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded-md bg-gray-200" />
          <div className="h-7 w-16 rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
