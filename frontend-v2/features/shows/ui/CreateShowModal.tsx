'use client'

import React, { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils'
import { mapApiError } from '@/shared/errors/mapApiError'
import { ApiError } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

type ShowCreate = components['schemas']['ShowCreate']

interface CreateShowModalProps {
  onClose: () => void
  onSubmit: (data: ShowCreate) => Promise<void>
  isPending: boolean
  error: Error | null
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
  'Asia/Tokyo',
]

export function CreateShowModal({ onClose, onSubmit, isPending, error }: CreateShowModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const mappedError = error instanceof ApiError ? mapApiError(error) : null
  const errorMessage = error
    ? mappedError
      ? mappedError.message
      : 'An unexpected error occurred. Please try again.'
    : null

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isPending, onClose])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const showTimeLocal = data.get('show_time') as string
    // datetime-local gives YYYY-MM-DDTHH:mm, convert to ISO with seconds
    const showTimeIso = showTimeLocal ? `${showTimeLocal}:00` : ''

    const body: ShowCreate = {
      artist_name: (data.get('artist_name') as string).trim(),
      city: (data.get('city') as string).trim(),
      venue: (data.get('venue') as string).trim(),
      show_time: showTimeIso,
      timezone: data.get('timezone') as string,
      capacity: parseInt(data.get('capacity') as string, 10),
      tickets_total: parseInt(data.get('tickets_total') as string, 10),
      tickets_sold: parseInt(data.get('tickets_sold') as string, 10),
      currency: 'USD',
    }

    onSubmit(body)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-show-title"
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose() }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="create-show-title" className="text-base font-semibold text-text">
            New Show
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            className="rounded p-1 text-text-muted hover:bg-bg hover:text-text disabled:opacity-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {errorMessage && (
              <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {errorMessage}
              </p>
            )}

            <Field label="Artist name" name="artist_name" required>
              <input
                ref={firstFieldRef}
                type="text"
                name="artist_name"
                id="artist_name"
                required
                maxLength={255}
                className={inputClass}
                placeholder="e.g. Radiohead"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="City" name="city" required>
                <input
                  type="text"
                  name="city"
                  id="city"
                  required
                  maxLength={100}
                  className={inputClass}
                  placeholder="e.g. New York"
                />
              </Field>

              <Field label="Venue" name="venue" required>
                <input
                  type="text"
                  name="venue"
                  id="venue"
                  required
                  maxLength={255}
                  className={inputClass}
                  placeholder="e.g. Madison Square Garden"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Show date & time" name="show_time" required>
                <input
                  type="datetime-local"
                  name="show_time"
                  id="show_time"
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Timezone" name="timezone" required>
                <select name="timezone" id="timezone" required className={inputClass}>
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Capacity" name="capacity" required>
                <input
                  type="number"
                  name="capacity"
                  id="capacity"
                  required
                  min={1}
                  className={inputClass}
                  placeholder="e.g. 10000"
                />
              </Field>

              <Field label="Tickets total" name="tickets_total" required>
                <input
                  type="number"
                  name="tickets_total"
                  id="tickets_total"
                  required
                  min={0}
                  className={inputClass}
                  placeholder="e.g. 10000"
                />
              </Field>

              <Field label="Tickets sold" name="tickets_sold" required>
                <input
                  type="number"
                  name="tickets_sold"
                  id="tickets_sold"
                  required
                  min={0}
                  defaultValue={0}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-md px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'rounded-md bg-primary px-4 py-2 text-sm font-medium text-white',
                'hover:opacity-90 disabled:opacity-50'
              )}
            >
              {isPending ? 'Creating…' : 'Create show'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  required?: boolean
  children: React.ReactNode
}

function Field({ label, name, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-xs font-medium text-text-muted">
        {label}{required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none'

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
