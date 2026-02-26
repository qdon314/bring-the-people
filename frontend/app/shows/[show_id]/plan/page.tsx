'use client'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { strategyApi } from '@/lib/api/strategy'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useCycles } from '@/lib/hooks/useCycles'
import { AgentRunButton } from '@/components/shared/AgentRunButton'
import { SegmentCard } from '@/components/strategy/SegmentCard'
import { FrameCard } from '@/components/strategy/FrameCard'
import { SegmentsSkeleton } from '@/components/strategy/SegmentsSkeleton'
import { FramesSkeleton } from '@/components/strategy/FramesSkeleton'

export default function PlanPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()

  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id

  const { data: segments, isLoading: segLoading } = useSegments(show_id, currentCycleId)
  const { data: frames, isLoading: frameLoading } = useFrames(show_id, currentCycleId)

  function onStrategyComplete() {
    // Delay slightly to allow backend to commit changes, then force refetch
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['cycles', show_id] })
      qc.invalidateQueries({ queryKey: ['segments', show_id] })
      qc.invalidateQueries({ queryKey: ['frames', show_id] })
      qc.refetchQueries({ queryKey: ['segments', show_id] })
      qc.refetchQueries({ queryKey: ['frames', show_id] })
    }, 500)
  }

  // Group frames by segment
  const framesBySegment = (frames ?? []).reduce<Record<string, typeof frames>>((acc, frame) => {
    acc[frame.segment_id] = [...(acc[frame.segment_id] ?? []), frame]
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

      {/* Strategy Run Panel */}
      <section aria-labelledby="strategy-heading">
        <div className="bg-surface border border-border rounded-lg p-6">
          <h2 id="strategy-heading" className="font-semibold text-lg mb-1">Strategy Agent</h2>
          <p className="text-sm text-text-muted mb-4">
            Analyzes the show and proposes 3–5 audience segments and framing hypotheses.
          </p>
          <AgentRunButton
            label="Run Strategy Agent"
            onRun={() => strategyApi.run(show_id)}
            onComplete={onStrategyComplete}
          />
        </div>
      </section>

      {/* Segments */}
      {(segLoading || (segments && segments.length > 0)) && (
        <section aria-labelledby="segments-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="segments-heading" className="font-semibold text-lg">Audience Segments</h2>
            <span className="text-sm text-text-muted">
              {segments?.filter(s => s.review_status === 'approved').length ?? 0} approved
            </span>
          </div>
          {segLoading ? (
            <SegmentsSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {segments!.map(segment => (
                <SegmentCard
                  key={segment.segment_id}
                  segment={segment}
                  onReviewed={() => {
                    qc.invalidateQueries({ queryKey: ['segments', show_id] })
                    qc.refetchQueries({ queryKey: ['segments', show_id] })
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Frames (grouped by segment) */}
      {(frameLoading || (frames && frames.length > 0)) && (
        <section aria-labelledby="frames-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="frames-heading" className="font-semibold text-lg">Creative Frames</h2>
            <span className="text-sm text-text-muted">
              {frames?.filter(f => f.review_status === 'approved').length ?? 0} approved
            </span>
          </div>
          {frameLoading ? (
            <FramesSkeleton />
          ) : (
            <div className="space-y-6">
              {(segments ?? []).map(segment => (
                <div key={segment.segment_id}>
                  <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                    {segment.name}
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {(framesBySegment[segment.segment_id] ?? []).map(frame => (
                      <FrameCard
                        key={frame.frame_id}
                        frame={frame}
                        onReviewed={() => {
                          qc.invalidateQueries({ queryKey: ['frames', show_id] })
                          qc.refetchQueries({ queryKey: ['frames', show_id] })
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {!segLoading && !segments?.length && (
        <div className="text-center py-16 text-text-muted">
          <p className="text-lg font-medium mb-2">Start by running the Strategy Agent</p>
          <p className="text-sm">The agent will analyze your show and propose audience segments and creative frames.</p>
        </div>
      )}

    </div>
  )
}
