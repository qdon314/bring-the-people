'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ExperimentLibraryModal } from '@/features/experiments/ui/ExperimentLibraryModal'
import type { ExperimentResponse } from '@/features/experiments/api'
import { useCreateRun } from '../queries'

const schema = z.object({
  budget_cap_cents_override: z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), {
      message: 'Must be a positive amount',
    }),
})

type FormValues = z.infer<typeof schema>

interface CreateRunFormProps {
  showId: string
  cycleId: string
}

export function CreateRunForm({ showId, cycleId }: CreateRunFormProps) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const createRun = useCreateRun()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function handleExperimentSelect(exp: ExperimentResponse) {
    setSelectedExperiment(exp)
  }

  function onSubmit(values: FormValues) {
    if (!selectedExperiment) return
    setSubmitError(null)

    const rawBudget = values.budget_cap_cents_override?.trim()
    const budgetCents = rawBudget ? Math.round(parseFloat(rawBudget) * 100) : undefined

    createRun.mutate(
      {
        experiment_id: selectedExperiment.experiment_id,
        cycle_id: cycleId,
        budget_cap_cents_override: budgetCents,
      },
      {
        onSuccess: () => {
          setSelectedExperiment(null)
          reset()
        },
        onError: () => {
          setSubmitError('Failed to create run. Try again or refresh the page.')
        },
      }
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-text mb-4">Create Run</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Experiment picker */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">Experiment</label>
          <div className="flex items-center gap-3">
            {selectedExperiment ? (
              <span className="text-sm text-text">
                {selectedExperiment.channel} — {selectedExperiment.objective}
              </span>
            ) : (
              <span className="text-sm text-text-muted">No experiment selected</span>
            )}
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border"
            >
              {selectedExperiment ? 'Change' : 'Pick Experiment'}
            </button>
          </div>
        </div>

        {/* Budget override */}
        <div>
          <label htmlFor="budget-override" className="block text-sm font-medium text-text mb-1">
            Budget override (optional, $)
          </label>
          <input
            id="budget-override"
            type="number"
            step="0.01"
            min="0"
            placeholder={
              selectedExperiment
                ? `Default: $${(selectedExperiment.budget_cap_cents / 100).toLocaleString()}`
                : 'e.g. 500'
            }
            {...register('budget_cap_cents_override')}
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.budget_cap_cents_override && (
            <p className="mt-1 text-xs text-red-600">{errors.budget_cap_cents_override.message}</p>
          )}
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedExperiment || createRun.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          >
            {createRun.isPending ? 'Creating…' : 'Create Run'}
          </button>
        </div>
      </form>

      <ExperimentLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        showId={showId}
        onSelect={handleExperimentSelect}
      />
    </div>
  )
}
