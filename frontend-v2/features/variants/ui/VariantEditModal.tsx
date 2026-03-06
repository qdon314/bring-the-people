'use client'

import React, { useState, useEffect } from 'react'
import { Dialog } from '@/shared/ui/dialog'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { showToast } from '@/shared/ui/toast'
import { useUpdateVariant } from '../mutations'
import type { VariantResponse } from '../api'

interface VariantEditModalProps {
  open: boolean
  onClose: () => void
  variant: VariantResponse
  frameId: string
}

export function VariantEditModal({ open, onClose, variant, frameId }: VariantEditModalProps) {
  const [hook, setHook] = useState('')
  const [body, setBody] = useState('')
  const [cta, setCta] = useState('')

  const updateMutation = useUpdateVariant(frameId)

  useEffect(() => {
    if (open) {
      setHook(variant.hook ?? '')
      setBody(variant.body ?? '')
      setCta(variant.cta ?? '')
    }
  }, [open, variant])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await updateMutation.mutateAsync({
        variantId: variant.variant_id,
        body: {
          hook: hook || null,
          body: body || null,
          cta: cta || null,
        },
      })
      showToast('Variant updated', 'success')
      onClose()
    } catch {
      showToast('Failed to update variant. Try again.', 'error')
    }
  }

  const isSaving = updateMutation.isPending

  return (
    <Dialog open={open} onClose={onClose} title="Edit variant">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="variant-hook"
              className="block text-sm font-medium text-text"
            >
              Hook
            </label>
            <textarea
              id="variant-hook"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={2}
              disabled={isSaving}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none disabled:opacity-50"
              placeholder="Enter hook..."
            />
          </div>

          <div>
            <label
              htmlFor="variant-body"
              className="block text-sm font-medium text-text"
            >
              Body
            </label>
            <textarea
              id="variant-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              disabled={isSaving}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none disabled:opacity-50"
              placeholder="Enter body..."
            />
          </div>

          <div>
            <label
              id="variant-cta-label"
              className="block text-sm font-medium text-text"
            >
              Call to Action
            </label>
            <input
              type="text"
              aria-labelledby="variant-cta-label"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              disabled={isSaving}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none disabled:opacity-50"
              placeholder="Enter CTA..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isSaving && <SpinnerIcon className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
