'use client'

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog } from '@/shared/ui/dialog'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { showToast } from '@/shared/ui/toast'
import { cn } from '@/shared/lib/utils'
import { useUpdateFrame } from '../mutations'
import type { FrameResponse } from '../api'

const schema = z.object({
  hypothesis: z.string().min(1, 'Hypothesis is required'),
  promise: z.string().min(1, 'Promise is required'),
  channel: z.string().min(1, 'Channel is required'),
  evidence_refs: z.array(z.record(z.string(), z.unknown())).optional(),
  risk_notes: z.string().optional(),
})

type FormValues = z.input<typeof schema>

interface FrameEditModalProps {
  frame: FrameResponse
  showId: string
  open: boolean
  onClose: () => void
}

export function FrameEditModal({ frame, showId, open, onClose }: FrameEditModalProps) {
  const updateMutation = useUpdateFrame(showId)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hypothesis: frame.hypothesis,
      promise: frame.promise,
      channel: frame.channel,
      evidence_refs: frame.evidence_refs,
      risk_notes: frame.risk_notes ?? '',
    },
  })

  function handleClose() {
    reset({
      hypothesis: frame.hypothesis,
      promise: frame.promise,
      channel: frame.channel,
      evidence_refs: frame.evidence_refs,
      risk_notes: frame.risk_notes ?? '',
    })
    onClose()
  }

  function onSubmit(values: FormValues) {
    updateMutation.mutate(
      {
        frameId: frame.frame_id,
        hypothesis: values.hypothesis,
        promise: values.promise,
        channel: values.channel,
        evidenceRefs: values.evidence_refs,
        riskNotes: values.risk_notes,
      },
      {
        onSuccess: () => {
          showToast('Frame saved', 'success')
          onClose()
        },
        onError: (error) => {
          if (error && typeof error === 'object' && 'status' in error && 'body' in error) {
            const apiError = error as { status: number; body: unknown }
            if (apiError.status === 422 && apiError.body && typeof apiError.body === 'object' && 'detail' in apiError.body) {
              const body = apiError.body as { detail?: Array<{ loc: string[]; msg: string }> }
              if (body.detail) {
                body.detail.forEach((err) => {
                  const field = err.loc[err.loc.length - 1] as keyof FormValues
                  if (field && field in schema.shape) {
                    setError(field, { message: err.msg })
                  }
                })
                return
              }
            }
          }
          showToast('Failed to save frame. Try again.', 'error')
        },
      }
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Edit frame" description="Edit the details of this frame.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {updateMutation.isError && (
          <div className="mb-4">
            <ErrorBanner
              message="Failed to save frame. Please try again."
            />
          </div>
        )}

        {/* Hypothesis field */}
        <div className="space-y-1">
          <label htmlFor="frame-hypothesis" className="block text-xs font-medium text-text-muted">
            Hypothesis
          </label>
          <textarea
            id="frame-hypothesis"
            {...register('hypothesis')}
            disabled={updateMutation.isPending}
            rows={3}
            className={cn(
              'w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted',
              'focus:border-primary focus:outline-none disabled:opacity-50',
              errors.hypothesis ? 'border-red-500' : 'border-border'
            )}
          />
          {errors.hypothesis && (
            <p role="alert" className="text-xs text-red-600">
              {errors.hypothesis.message}
            </p>
          )}
          <p className="text-xs text-text-muted">
            Original: <span className="italic">{frame.hypothesis}</span>
          </p>
        </div>

        {/* Promise field */}
        <div className="mt-4 space-y-1">
          <label htmlFor="frame-promise" className="block text-xs font-medium text-text-muted">
            Promise
          </label>
          <textarea
            id="frame-promise"
            {...register('promise')}
            disabled={updateMutation.isPending}
            rows={3}
            className={cn(
              'w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted',
              'focus:border-primary focus:outline-none disabled:opacity-50',
              errors.promise ? 'border-red-500' : 'border-border'
            )}
          />
          {errors.promise && (
            <p role="alert" className="text-xs text-red-600">
              {errors.promise.message}
            </p>
          )}
          <p className="text-xs text-text-muted">
            Original: <span className="italic">{frame.promise}</span>
          </p>
        </div>

        {/* Channel field */}
        <div className="mt-4 space-y-1">
          <label htmlFor="frame-channel" className="block text-xs font-medium text-text-muted">
            Channel
          </label>
          <input
            id="frame-channel"
            type="text"
            {...register('channel')}
            disabled={updateMutation.isPending}
            className={cn(
              'w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted',
              'focus:border-primary focus:outline-none disabled:opacity-50',
              errors.channel ? 'border-red-500' : 'border-border'
            )}
          />
          {errors.channel && (
            <p role="alert" className="text-xs text-red-600">
              {errors.channel.message}
            </p>
          )}
          <p className="text-xs text-text-muted">
            Original: <span className="italic">{frame.channel}</span>
          </p>
        </div>

        {/* Risk notes field */}
        <div className="mt-4 space-y-1">
          <label htmlFor="frame-risk-notes" className="block text-xs font-medium text-text-muted">
            Risk notes <span className="font-normal">(optional)</span>
          </label>
          <textarea
            id="frame-risk-notes"
            {...register('risk_notes')}
            disabled={updateMutation.isPending}
            rows={2}
            className={cn(
              'w-full rounded-md border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted',
              'focus:border-primary focus:outline-none disabled:opacity-50',
              errors.risk_notes ? 'border-red-500' : 'border-border'
            )}
          />
          {errors.risk_notes && (
            <p role="alert" className="text-xs text-red-600">
              {errors.risk_notes.message}
            </p>
          )}
          {frame.risk_notes && (
            <p className="text-xs text-text-muted">
              Original: <span className="italic">{frame.risk_notes}</span>
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={updateMutation.isPending}
            className="rounded-md px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white',
              'hover:opacity-90 disabled:opacity-50'
            )}
          >
            {updateMutation.isPending && <SpinnerIcon className="h-4 w-4" />}
            {updateMutation.isPending ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
