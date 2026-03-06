'use client'

import React, { useState } from 'react'
import { FramePicker } from '@/features/creative/ui/FramePicker'
import { CreativeQueue } from '@/features/creative/ui/CreativeQueue'
import { VariantGroup } from '@/features/variants/ui/VariantGroup'
import { useFrames } from '@/features/frames/queries'
import { cn } from '@/shared/lib/utils'

interface CreatePageProps {
  params: { show_id: string; cycle_id: string }
}

export default function CreatePage({ params }: CreatePageProps) {
  const [activeJobs, setActiveJobs] = useState<Array<{ frameId: string; jobId: string }>>([])
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [completedFrameIds, setCompletedFrameIds] = useState<Set<string>>(new Set())

  const { data: frames } = useFrames(params.show_id, params.cycle_id)

  const handleJobsStarted = (jobs: Array<{ frameId: string; jobId: string }>) => {
    setActiveJobs((prev) => [...prev, ...jobs])
  }

  const handleJobComplete = (frameId: string) => {
    setActiveJobs((prev) => prev.filter((job) => job.frameId !== frameId))
    setCompletedFrameIds((prev) => new Set(Array.from(prev).concat(frameId)))
    // Auto-select completed frame to show variants
    setSelectedFrameId(frameId)
  }

  const handleJobFailed = (frameId: string) => {
    setActiveJobs((prev) => prev.filter((job) => job.frameId !== frameId))
  }

  // Get frames that have variants (completed generation)
  const framesWithVariants = (frames ?? []).filter((frame) =>
    completedFrameIds.has(frame.frame_id)
  )

  return (
    <main className="min-h-screen space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-text">Create</h1>
        <p className="mt-1 text-sm text-text-muted">
          Generate and review creative variants
        </p>
      </div>

      {/* Frame Picker Section */}
      <section>
        <h2 className="mb-4 text-lg font-medium text-text">Select Frames</h2>
        <FramePicker
          showId={params.show_id}
          cycleId={params.cycle_id}
          onJobsStarted={handleJobsStarted}
        />
      </section>

      {/* Creative Queue Section */}
      {activeJobs.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-text">Generation Queue</h2>
          <CreativeQueue
            jobs={activeJobs}
            onJobComplete={handleJobComplete}
            onJobFailed={handleJobFailed}
          />
        </section>
      )}

      {/* Frame Selector + Variant Review Section */}
      {framesWithVariants.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-text">Review Variants</h2>

          {/* Frame Tabs */}
          <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
            {framesWithVariants.map((frame) => (
              <button
                key={frame.frame_id}
                onClick={() => setSelectedFrameId(frame.frame_id)}
                className={cn(
                  'rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                  selectedFrameId === frame.frame_id
                    ? 'border-b-2 border-primary bg-primary/10 text-primary'
                    : 'text-text-muted hover:bg-bg hover:text-text'
                )}
              >
                <span className="line-clamp-1">{frame.hypothesis}</span>
                <span className="ml-2 text-xs opacity-70">({frame.channel})</span>
              </button>
            ))}
          </div>

          {/* Variants for selected frame */}
          {selectedFrameId && <VariantGroup frameId={selectedFrameId} />}
        </section>
      )}
    </main>
  )
}
