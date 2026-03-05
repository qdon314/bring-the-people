'use client'

import React, { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { Dialog } from '@/shared/ui/dialog'
import { showToast } from '@/shared/ui/toast'
import { useApproveSegment, useRejectSegment } from '../mutations'
import type { SegmentResponse } from '../api'

interface SegmentCardProps {
  segment: SegmentResponse
  showId: string
}

export function SegmentCard({ segment, showId }: SegmentCardProps) {
  const [definitionExpanded, setDefinitionExpanded] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const approveMutation = useApproveSegment(showId)
  const rejectMutation = useRejectSegment(showId)

  const isDecided = segment.review_status === 'approved' || segment.review_status === 'rejected'
  const isPending = segment.review_status === 'pending'

  function handleApprove() {
    approveMutation.mutate(
      { segmentId: segment.segment_id },
      {
        onSuccess: () => showToast('Segment approved', 'success'),
        onError: () => showToast('Failed to approve segment. Try again or refresh the page.', 'error'),
      }
    )
  }

  function handleRejectConfirm() {
    rejectMutation.mutate(
      { segmentId: segment.segment_id, notes: rejectReason },
      {
        onSuccess: () => {
          showToast('Segment rejected', 'success')
          setRejectDialogOpen(false)
          setRejectReason('')
        },
        onError: () => {
          showToast('Failed to reject segment. Try again or refresh the page.', 'error')
        },
      }
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-text">{segment.name}</h3>
            <StatusBadge status={segment.review_status} />
          </div>

          {segment.estimated_size != null && (
            <p className="mt-1 text-xs text-text-muted">
              Estimated size: {segment.estimated_size.toLocaleString()}
            </p>
          )}

          {isDecided && segment.reviewed_by && (
            <p className="mt-1 text-xs text-text-muted">
              Reviewed by {segment.reviewed_by}
              {segment.reviewed_at && (
                <> &middot; {new Date(segment.reviewed_at).toLocaleDateString()}</>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPending && (
            <button
              type="button"
              onClick={() => {/* V2-033: wire edit modal */}}
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
        </div>
      </div>

      {/* Definition JSON preview */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setDefinitionExpanded((v) => !v)}
          className="text-xs text-text-muted hover:text-text"
        >
          {definitionExpanded ? 'Hide definition' : 'Show definition'}
        </button>
        {definitionExpanded && (
          <pre className="mt-2 overflow-auto rounded-md bg-bg p-3 text-xs text-text">
            {JSON.stringify(segment.definition_json, null, 2)}
          </pre>
        )}
      </div>

      {/* Reject confirmation dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          setRejectDialogOpen(false)
          setRejectReason('')
        }}
        title="Reject segment"
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to reject <strong>{segment.name}</strong>?
        </p>
        <div className="mt-4">
          <label htmlFor={`reject-reason-${segment.segment_id}`} className="block text-xs font-medium text-text-muted">
            Reason (optional)
          </label>
          <textarea
            id={`reject-reason-${segment.segment_id}`}
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
            {rejectMutation.isPending ? 'Rejecting\u2026' : 'Reject segment'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}

export function SegmentCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded-md bg-gray-200" />
          <div className="h-7 w-16 rounded-md bg-gray-200" />
        </div>
      </div>
      <div className="mt-3">
        <div className="h-3 w-24 rounded bg-gray-200" />
      </div>
    </div>
  )
}
