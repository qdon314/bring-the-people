'use client'
import { useParams } from 'next/navigation'
import { useShow } from '@/lib/hooks/useShow'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useMemos } from '@/lib/hooks/useMemos'
import { useCycles } from '@/lib/hooks/useCycles'
import { ShowHeader } from '@/components/layout/ShowHeader'
import { CycleStepper } from '@/components/layout/CycleStepper'

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

  // Stepper completion logic (current cycle only)
  const stepperState = {
    plan: (segments?.length ?? 0) > 0,
    create: (frames?.some(f => false)) ?? false,  // TODO: need variant counts
    run: experiments?.some(e => e.cycle_id === currentCycle?.cycle_id) ?? false,
    results: false,   // TODO: check observations
    memo: (memos?.length ?? 0) > 0,
  }

  if (!show) return <ShowLayoutSkeleton />

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ShowHeader show={show} />
      <CycleStepper showId={show_id} state={stepperState} />
      <div className="flex-1 overflow-y-auto">
        {children}
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
