'use client'

import React, { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { Dialog } from '@/shared/ui/dialog'
import { showToast } from '@/shared/ui/toast'
import { useApproveVariant, useRejectVariant, useUndoVariantReview } from '../mutations'
import type { VariantResponse } from '../api'
import { VariantEditModal } from './VariantEditModal'

interface VariantCardProps {
  variant: VariantResponse
  frameId: string
  onEdit?: () => void
}

export function VariantCard({ variant, frameId, onEdit }: VariantCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  const approveMutation = useApproveVariant(frameId)
  const rejectMutation = useRejectVariant(frameId)
  const undoMutation = useUndoVariantReview(frameId)

  const isDecided = variant.review_status === 'approved' || variant.review_status === 'rejected'
  const isPending = variant.review_status === 'pending'

  function handleEditClick() {
    setEditModalOpen(true)
    onEdit?.()
  }

  function handleApprove() {
    approveMutation.mutate(
      { variantId: variant.variant_id },
      {
        onSuccess: () => showToast('Variant approved', 'success'),
        onError: () => showToast('Failed to approve variant. Try again or refresh the page.', 'error'),
      }
    )
  }

  function handleRejectConfirm() {
    rejectMutation.mutate(
      { variantId: variant.variant_id, notes: rejectReason },
      {
        onSuccess: () => {
          showToast('Variant rejected', 'success')
          setRejectDialogOpen(false)
          setRejectReason('')
        },
        onError: () => {
          showToast('Failed to reject variant. Try again or refresh the page.', 'error')
        },
      }
    )
  }

  function handleUndo() {
    undoMutation.mutate(
      { variantId: variant.variant_id },
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-bg px-2 py-0.5 text-xs font-medium text-text-muted ring-1 ring-inset ring-border">
              {variant.platform}
            </span>
            <StatusBadge status={variant.review_status} />
            {variant.constraints_passed === false && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                Constraints failed
              </span>
            )}
          </div>

          <p className="mt-2 text-sm font-semibold text-text">{variant.hook}</p>
          <p className="mt-1 text-sm text-text-muted">{variant.body}</p>
          {variant.cta && (
            <p className="mt-1 text-xs font-medium text-primary">CTA: {variant.cta}</p>
          )}

          {isDecided && (variant.reviewed_by || variant.reviewed_at) && (
            <p className="mt-2 text-xs text-text-muted">
              {variant.reviewed_by && <>Reviewed by {variant.reviewed_by}</>}
              {variant.reviewed_at && (
                <> &middot; {new Date(variant.reviewed_at).toLocaleDateString()}</>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isPending && (
            <button
              type="button"
              onClick={handleEditClick}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600',
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
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {rejectMutation.isPending && <SpinnerIcon className="h-3 w-3" />}
            {rejectMutation.isPending ? 'Rejecting\u2026' : 'Reject'}
          </button>

          {variant.review_status !== 'pending' && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoMutation.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                'bg-gray-500 text-white hover:bg-gray-600',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500',
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
        title="Reject variant"
      >
        <p className="text-sm text-text-muted">
          Are you sure you want to reject this variant?
        </p>
        <div className="mt-4">
          <label
            htmlFor={`reject-reason-${variant.variant_id}`}
            className="block text-xs font-medium text-text-muted"
          >
            Reason (optional)
          </label>
          <textarea
            id={`reject-reason-${variant.variant_id}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            placeholder="Enter reason\u2026"
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
            className="rounded-md px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRejectConfirm}
            disabled={rejectMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white',
              'hover:bg-red-700 disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600'
            )}
          >
            {rejectMutation.isPending && <SpinnerIcon className="h-4 w-4" />}
            {rejectMutation.isPending ? 'Rejecting\u2026' : 'Reject variant'}
          </button>
        </div>

        <VariantEditModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          variant={variant}
          frameId={frameId}
        />
      </Dialog>
    </div>
  )
}

export function VariantCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 rounded-md bg-gray-200" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
          </div>
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-3 w-64 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded-md bg-gray-200" />
          <div className="h-7 w-16 rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
