'use client'

import { useRunsByCycle } from '@/features/runs/queries'
import { useMemo } from 'react'

interface RunSelectorProps {
  cycleId: string
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
}

export function RunSelector({ cycleId, selectedRunId, onSelectRun }: RunSelectorProps) {
  const { data: runs, isLoading, error } = useRunsByCycle(cycleId)
  
  const launchableRuns = useMemo(() => {
    if (!runs) return []
    return runs.filter(r => r.status === 'launched' || r.status === 'completed')
  }, [runs])
  
  if (isLoading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded" />
  }
  
  if (error) {
    return <div className="text-red-500 text-sm">Failed to load runs</div>
  }
  
  if (launchableRuns.length === 0) {
    return <div className="text-gray-500 text-sm">No launched runs in this cycle</div>
  }
  
  return (
    <select
      value={selectedRunId || ''}
      onChange={(e) => onSelectRun(e.target.value)}
      className="border rounded px-3 py-2"
    >
      <option value="">Select a run to view results</option>
      {launchableRuns.map(run => (
        <option key={run.run_id} value={run.run_id}>
          {run.experiment_id.substring(0, 8)} — {run.status}
        </option>
      ))}
    </select>
  )
}
