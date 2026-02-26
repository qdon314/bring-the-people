'use client'
import { useParams } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { useShow } from '@/lib/hooks/useShow'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useMemos } from '@/lib/hooks/useMemos'
import { useCycles } from '@/lib/hooks/useCycles'
import { variantsApi } from '@/lib/api/variants'
import { experimentsApi } from '@/lib/api/experiments'
import { ShowHeader } from '@/components/layout/ShowHeader'
import { CycleStepper } from '@/components/layout/CycleStepper'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

export default function ShowLayout({ children }: { children: React.ReactNode }) {
  const { show_id } = useParams<{ show_id: string }>()

  const { data: show } = useShow(show_id)
  const { data: cycles } = useCycles(show_id)

  // Current cycle = most recent
  const currentCycle = cycles?.[0] ?? null

  // Scoping all queries to current cycle
  const { data: segments } = useSegments(show_id, currentCycle?.cycle_id)
  const { data: frames } = useFrames(show_id, currentCycle?.cycle_id)
  const { data: experiments } = useExperiments(show_id)
  const { data: memos } = useMemos(show_id)
  const cycleExperiments = (experiments ?? []).filter((exp) => exp.cycle_id === currentCycle?.cycle_id)

  const variantQueries = useQueries({
    queries: (frames ?? []).map((frame) => ({
      queryKey: ['variants', frame.frame_id],
      queryFn: () => variantsApi.list(frame.frame_id),
      enabled: !!frame.frame_id,
    })),
  })

  const experimentMetricsQueries = useQueries({
    queries: cycleExperiments.map((exp) => ({
      queryKey: ['experiments', exp.experiment_id, 'metrics'],
      queryFn: () => experimentsApi.metrics(exp.experiment_id),
      enabled: !!exp.experiment_id,
    })),
  })

  const totalVariants = variantQueries.reduce((acc, query) => acc + (query.data?.length ?? 0), 0)
  const hasResults = experimentMetricsQueries.some((query) => (query.data?.windows_count ?? 0) > 0)
  const hasMemo = currentCycle
    ? (memos ?? []).some((memo) => memo.cycle_id === currentCycle.cycle_id || memo.cycle_id === null)
    : (memos?.length ?? 0) > 0

  // Stepper completion logic (current cycle only)
  const stepperState = {
    plan: (segments?.length ?? 0) > 0,
    create: totalVariants > 0,
    run: cycleExperiments.length > 0,
    results: hasResults,
    memo: hasMemo,
  }

  if (!show) return <ShowLayoutSkeleton />

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ShowHeader show={show} />
      <CycleStepper showId={show_id} state={stepperState} />
      <div className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  )
}

function ShowLayoutSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="bg-surface border-b border-border px-8 py-5 animate-pulse">
        <div className="h-8 bg-bg rounded w-1/3 mb-2" />
        <div className="h-4 bg-bg rounded w-1/4" />
      </div>
      <div className="bg-surface border-b border-border px-8 py-3 animate-pulse">
        <div className="h-10 bg-bg rounded" />
      </div>
      <div className="flex-1 p-8">
        <div className="h-64 bg-bg rounded animate-pulse" />
      </div>
    </div>
  )
}
