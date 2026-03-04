'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useShows, useCreateShow } from '@/features/shows/queries'
import { ShowCard } from '@/features/shows/ui/ShowCard'
import { CreateShowModal } from '@/features/shows/ui/CreateShowModal'
import { mapApiError } from '@/shared/errors/mapApiError'
import { ApiError } from '@/shared/api/client'
import type { components } from '@/shared/api/generated/schema'

type ShowCreate = components['schemas']['ShowCreate']

export default function ShowsPage() {
  const router = useRouter()
  const { data: shows, isLoading, error } = useShows()
  const createShow = useCreateShow()
  const [isModalOpen, setIsModalOpen] = useState(false)

  async function handleCreate(data: ShowCreate) {
    const show = await createShow.mutateAsync(data)
    setIsModalOpen(false)
    router.push(`/shows/${show.show_id}`)
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-5">
        <h1 className="text-lg font-semibold text-text">Shows</h1>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          New Show
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-8 py-8">
        {isLoading && (
          <ul className="space-y-3" aria-label="Loading shows">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
            ))}
          </ul>
        )}

        {!isLoading && error && (
          <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
            {error instanceof ApiError ? mapApiError(error).message : 'Failed to load shows. Please refresh.'}
          </p>
        )}

        {!isLoading && !error && shows && shows.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-text-muted">No shows yet.</p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Create your first show
            </button>
          </div>
        )}

        {!isLoading && !error && shows && shows.length > 0 && (
          <ul className="space-y-3">
            {shows.map((show) => (
              <li key={String(show.show_id)}>
                <ShowCard show={show} />
              </li>
            ))}
          </ul>
        )}
      </main>

      {isModalOpen && (
        <CreateShowModal
          onClose={() => { setIsModalOpen(false); createShow.reset() }}
          onSubmit={handleCreate}
          isPending={createShow.isPending}
          error={createShow.error}
        />
      )}
    </div>
  )
}
