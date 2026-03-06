'use client'

import React, { useState } from 'react'
import { Dialog } from '@/shared/ui/dialog'
import { ErrorBanner } from '@/shared/ui/ErrorBanner'
import { EmptyState } from '@/shared/ui/EmptyState'
import { SpinnerIcon } from '@/shared/ui/SpinnerIcon'
import { useExperiments } from '../queries'
import type { ExperimentResponse } from '../api'

interface ExperimentLibraryModalProps {
  open: boolean
  onClose: () => void
  showId: string
  onSelect: (experiment: ExperimentResponse) => void
}

export function ExperimentLibraryModal({
  open,
  onClose,
  showId,
  onSelect,
}: ExperimentLibraryModalProps) {
  const [channelFilter, setChannelFilter] = useState('')
  const { data: experiments, isLoading, error } = useExperiments(showId)

  const channels = experiments
    ? Array.from(new Set(experiments.map((e) => e.channel))).sort()
    : []

  const filtered = experiments
    ? channelFilter
      ? experiments.filter((e) => e.channel === channelFilter)
      : experiments
    : []

  function handleSelect(exp: ExperimentResponse) {
    onSelect(exp)
    onClose()
  }

  return (
    <Dialog
      key={open ? 'open' : 'closed'}
      open={open}
      onClose={onClose}
      title="Experiment Library"
      description="Browse and select a show-level experiment to run in this cycle."
      className="max-w-lg"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="channel-filter" className="block text-xs font-medium text-text-muted mb-1">
            Filter by channel
          </label>
          <select
            id="channel-filter"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All channels</option>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <ErrorBanner message="Failed to load experiments. Try again or refresh the page." />
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <SpinnerIcon className="h-5 w-5 text-text-muted" />
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <EmptyState
            title="No experiments found"
            description={
              channelFilter
                ? `No experiments for channel "${channelFilter}". Try clearing the filter.`
                : 'No experiments exist yet. Create one in the Plan tab.'
            }
          />
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
            {filtered.map((exp) => (
              <li key={exp.experiment_id}>
                <button
                  onClick={() => handleSelect(exp)}
                  className="w-full text-left rounded-md border border-border bg-surface px-4 py-3 hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="text-sm font-medium text-text">
                    {exp.channel} — {exp.objective}
                  </div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    Budget: ${(exp.budget_cap_cents / 100).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
