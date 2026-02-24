'use client'
import { useState, useEffect } from 'react'
import { useJobPoller } from '@/lib/hooks/useJobPoller'
import { SpinnerIcon } from '@/components/shared/SpinnerIcon'
import { timeSince } from '@/lib/utils/dates'
import type { BackgroundJob } from '@/lib/types'

interface AgentRunButtonProps {
  label: string
  onRun: () => Promise<{ job_id: string }>
  onComplete?: (job: BackgroundJob) => void
  disabled?: boolean
  lastRunSummary?: string
  lastRunAt?: string
}

type State = 'idle' | 'starting' | 'polling' | 'done' | 'error'

export function AgentRunButton({
  label, onRun, onComplete, disabled, lastRunSummary, lastRunAt
}: AgentRunButtonProps) {
  const [state, setState] = useState<State>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: job } = useJobPoller(state === 'polling' ? jobId : null)

  // React to job status changes
  useEffect(() => {
    if (!job || state !== 'polling') return
    if (job.status === 'completed') {
      setState('done')
      onComplete?.(job)
    } else if (job.status === 'failed') {
      setState('error')
      setErrorMsg(job.error_message ?? 'Agent run failed')
    }
  }, [job, state, onComplete])

  async function handleRun() {
    setState('starting')
    setErrorMsg(null)
    try {
      const { job_id } = await onRun()
      setJobId(job_id)
      setState('polling')
    } catch (e: unknown) {
      setState('error')
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start agent')
    }
  }

  const isRunning = state === 'starting' || state === 'polling'

  return (
    <div className="space-y-3">
      {/* Main button */}
      <button
        onClick={handleRun}
        disabled={disabled || isRunning}
        className="btn-primary inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {isRunning && <SpinnerIcon className="w-4 h-4 animate-spin motion-reduce:animate-none" />}
        {state === 'starting' ? 'Starting…' :
         state === 'polling' ? `Running… (attempt ${job?.attempt_count ?? 1})` :
         label}
      </button>

      {/* Status line */}
      {state === 'polling' && job && (
        <p className="text-xs text-text-muted">
          Last updated {timeSince(job.updated_at)}
        </p>
      )}

      {/* Error */}
      {state === 'error' && errorMsg && (
        <div className="rounded-lg bg-danger-light p-3 flex items-center justify-between">
          <p className="text-sm text-danger">{errorMsg}</p>
          <button
            onClick={handleRun}
            className="text-sm font-medium text-danger underline focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 rounded"
          >
            Retry
          </button>
        </div>
      )}

      {/* Success summary */}
      {state === 'done' && job?.result_json && (
        <details className="rounded-lg bg-success-light p-3">
          <summary className="text-sm font-medium text-success cursor-pointer focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 rounded">
            ✓ Complete — {job.result_json.reasoning_summary?.toString().slice(0, 80)}…
          </summary>
          <div className="mt-2 text-xs text-text-muted space-y-1">
            <p>Turns used: {String(job.result_json.turns_used ?? '—')}</p>
            <p>Run ID: <code className="font-mono">{String(job.result_json.run_id ?? '—')}</code></p>
          </div>
        </details>
      )}

      {/* Previous run info (when idle) */}
      {state === 'idle' && lastRunSummary && (
        <p className="text-xs text-text-muted">
          Last run: {lastRunSummary} · {lastRunAt && timeSince(lastRunAt)}
        </p>
      )}
    </div>
  )
}
