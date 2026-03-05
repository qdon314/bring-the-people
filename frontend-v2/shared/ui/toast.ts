/**
 * Minimal browser toast utility using the native Notification API fallback.
 * Since no toast library is installed, we dispatch a custom DOM event that
 * a ToastContainer can listen for. Components can also use this directly
 * for testing by observing the event.
 */

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastEvent {
  message: string
  variant: ToastVariant
}

const TOAST_EVENT = 'app:toast'

export function showToast(message: string, variant: ToastVariant = 'info'): void {
  if (typeof window === 'undefined') return
  const event = new CustomEvent<ToastEvent>(TOAST_EVENT, {
    detail: { message, variant },
    bubbles: true,
  })
  window.dispatchEvent(event)
}
