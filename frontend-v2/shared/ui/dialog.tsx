'use client'

import React from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { cn } from '@/shared/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional accessible description announced to screen readers. */
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Accessible modal dialog built on Radix UI Dialog primitive.
 * Provides focus trap, Escape key, and overlay click to close.
 * Renders aria-describedby via RadixDialog.Description for screen-reader support.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay data-testid="dialog-overlay" className="fixed inset-0 z-50 bg-black/50" />
        <RadixDialog.Content
          aria-modal="true"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface shadow-xl p-0',
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <RadixDialog.Title className="text-base font-semibold text-text">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Close"
              className="rounded p-1 text-text-muted hover:bg-bg hover:text-text"
            >
              <CloseIcon className="h-5 w-5" />
            </RadixDialog.Close>
          </div>
          {/* RadixDialog.Description wires aria-describedby automatically */}
          <RadixDialog.Description className={cn(!description && 'sr-only')}>
            {description ?? title}
          </RadixDialog.Description>
          <div className="px-6 py-5">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
