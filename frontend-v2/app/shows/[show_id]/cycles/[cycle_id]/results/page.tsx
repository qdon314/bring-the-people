'use client'

import { useState, useEffect } from 'react'
import { RunSelector, ObservationForm, ResultsOverview, DecisionOverride } from '@/features/results/ui'
import { useEvaluateRun } from '@/features/decisions/queries'
import { useRunsByCycle } from '@/features/runs/queries'

interface ResultsPageProps {
  params: { show_id: string; cycle_id: string }
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const evaluateRun = useEvaluateRun()
  const { data: runs } = useRunsByCycle(params.cycle_id)
  
  useEffect(() => {
    if (!selectedRunId && runs && runs.length > 0) {
      const launchedRun = runs.find(r => r.status === 'launched' || r.status === 'completed')
      if (launchedRun) {
        setSelectedRunId(launchedRun.run_id)
      }
    }
  }, [runs, selectedRunId])
  
  const handleRunDecision = async () => {
    if (!selectedRunId) return
    await evaluateRun.mutateAsync(selectedRunId)
  }
  
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Results</h1>
      <p className="mt-2 text-sm text-gray-500">Cycle {params.cycle_id} — Stage 6</p>
      
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Select Run</label>
        <RunSelector
          cycleId={params.cycle_id}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
        />
      </div>
      
      {selectedRunId && (
        <>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-medium mb-4">Add Observation</h2>
              <ObservationForm runId={selectedRunId} />
            </div>
            
            <div>
              <DecisionOverride runId={selectedRunId} />
            </div>
          </div>
          
          <div className="mt-8">
            <ResultsOverview
              runId={selectedRunId}
              onRunDecision={handleRunDecision}
              isEvaluating={evaluateRun.isPending}
            />
          </div>
        </>
      )}
    </main>
  )
}
