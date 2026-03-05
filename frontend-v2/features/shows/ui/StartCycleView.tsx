'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useCreateCycle } from '@/features/cycles/queries'

interface StartCycleViewProps {
  showId: string
}

export function StartCycleView({ showId }: StartCycleViewProps) {
  const router = useRouter()
  const { mutateAsync, isPending, error } = useCreateCycle()

  async function handleStart() {
    const cycle = await mutateAsync(showId)
    router.push(`/shows/${showId}/cycles/${cycle.cycle_id}/overview`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-text">No cycles yet</h1>
        <p className="mt-2 text-sm text-text-muted">
          Start a cycle to begin planning your marketing strategy for this show.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            Failed to create cycle. Please try again.
          </p>
        )}
        <button
          onClick={handleStart}
          disabled={isPending}
          className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Starting...' : 'Start Cycle'}
        </button>
      </div>
    </main>
  )
}
