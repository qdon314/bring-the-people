'use client'

import { useSegments } from '@/features/segments/queries'
import { useFrames } from '@/features/frames/queries'
import { StrategyRunPanel } from '@/features/strategy/ui/StrategyRunPanel'
import { ExperimentForm } from '@/features/experiments/ui/ExperimentForm'
import { SegmentList } from '@/features/segments/ui/SegmentList'
import { FrameList } from '@/features/frames/ui/FrameList'

interface PlanPageProps {
  params: { show_id: string; cycle_id: string }
}

export default function PlanPage({ params }: PlanPageProps) {
  const { show_id, cycle_id } = params

  const { data: segments = [], isPending: segmentsLoading } = useSegments(show_id, cycle_id)
  const { data: frames = [], isPending: framesLoading } = useFrames(show_id, cycle_id)

  const showStrategyPanel = segments.length === 0 && !segmentsLoading

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Plan</h1>
      <p className="mt-2 text-sm text-gray-500">Cycle {cycle_id}</p>

      {showStrategyPanel && <StrategyRunPanel showId={show_id} cycleId={cycle_id} />}

      <ExperimentForm
        showId={show_id}
        cycleId={cycle_id}
        approvedSegments={segments.filter((s) => s.review_status === 'approved')}
        approvedFrames={frames.filter((f) => f.review_status === 'approved')}
      />

      <section className="mt-8">
        <h2 className="text-xl font-medium">Segments</h2>
        <SegmentList showId={show_id} cycleId={cycle_id} />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-medium">Frames</h2>
        <FrameList showId={show_id} cycleId={cycle_id} />
      </section>
    </main>
  )
}
