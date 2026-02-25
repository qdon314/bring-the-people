'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useCycles } from '@/lib/hooks/useCycles'
import { ExperimentBuilderForm } from '@/components/experiments/ExperimentBuilderForm'
import { ExperimentCard } from '@/components/experiments/ExperimentCard'

export default function RunPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()
  const [showBuilder, setShowBuilder] = useState(false)
  const { data: cycles, isLoading: cyclesLoading } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id
  const { data: experiments, isLoading: experimentsLoading } = useExperiments(show_id)
  const cycleExperiments = experiments?.filter(e => e.cycle_id === currentCycleId) ?? []

  if (cyclesLoading || experimentsLoading) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 text-center text-text-muted">
        <p className="text-lg font-medium mb-2">Loading experiments…</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

      {/* Header + new experiment button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Experiments</h3>
          <p className="text-sm text-text-muted">Build experiments from approved creative; mark launched when ads are live.</p>
        </div>
        <button onClick={() => setShowBuilder(v => !v)} className="btn-primary">
          {showBuilder ? 'Cancel' : '+ New Experiment'}
        </button>
      </div>

      {/* Builder (collapsible) */}
      {showBuilder && (
        <ExperimentBuilderForm
          showId={show_id}
          cycleId={currentCycleId ?? null}
          onCreated={() => {
            setShowBuilder(false)
            qc.invalidateQueries({ queryKey: ['experiments', show_id] })
          }}
        />
      )}

      {/* Experiments list */}
      {cycleExperiments.length === 0 && !showBuilder && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-lg font-medium mb-2">No experiments yet</p>
          <p className="text-sm">Build an experiment from approved creative to get started.</p>
        </div>
      )}

      {cycleExperiments.map(exp => (
        <ExperimentCard
          key={exp.experiment_id}
          experiment={exp}
          showId={show_id}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['experiments', show_id] })}
        />
      ))}

    </div>
  )
}
