'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { cn } from '@/shared/lib/utils'
import type { ToastEvent, ToastVariant } from './toast'

const TOAST_EVENT = 'app:toast'
const AUTO_DISMISS_MS = 4000

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 text-white',
}

let nextId = 1

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    function handleToast(event: Event) {
      const { message, variant } = (event as CustomEvent<ToastEvent>).detail
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    }

    window.addEventListener(TOAST_EVENT, handleToast)
    return () => window.removeEventListener(TOAST_EVENT, handleToast)
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'flex items-center justify-between gap-4 rounded-lg px-4 py-3 shadow-lg text-sm font-medium min-w-[240px] max-w-sm',
            VARIANT_CLASSES[toast.variant]
          )}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 rounded p-0.5 opacity-80 hover:opacity-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
