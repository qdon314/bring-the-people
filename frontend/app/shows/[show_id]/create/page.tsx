'use client'
import { useParams, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFrames } from '@/lib/hooks/useFrames'
import { useCycles } from '@/lib/hooks/useCycles'
import { creativeApi } from '@/lib/api/creative'
import { FramePickerPanel } from '@/components/creative/FramePickerPanel'
import { CreativeReviewPanel } from '@/components/creative/CreativeReviewPanel'

export default function CreatePage() {
  const { show_id } = useParams<{ show_id: string }>()
  const searchParams = useSearchParams()
  const preselectedFrameId = searchParams.get('frame_id')

  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id

  const { data: frames } = useFrames(show_id, currentCycleId)

  // Frame selection state — default to preselected if coming from Plan tab
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(
    preselectedFrameId ? new Set([preselectedFrameId]) : new Set()
  )

  // Track active jobs per frame
  const [frameJobs, setFrameJobs] = useState<Record<string, string>>({})  // frameId → jobId

  async function generateForSelected() {
    const selectedIds = Array.from(selectedFrameIds)
    const results = await Promise.allSettled(
      selectedIds.map(async (frameId) => {
        const { job_id } = await creativeApi.run(frameId)
        setFrameJobs(prev => ({ ...prev, [frameId]: job_id }))
      })
    )
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to generate for frame ${selectedIds[index]}:`, result.reason)
      }
    })
  }

  function onVariantsGenerated(frameId: string) {
    qc.invalidateQueries({ queryKey: ['variants', frameId] })
  }

  if (!frames?.length) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 text-center text-text-muted">
        <p className="text-lg font-medium mb-2">No frames yet</p>
        <p className="text-sm">Run the Strategy Agent on the Plan tab first to propose frames.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

      {/* Frame picker + generate button */}
      <section aria-labelledby="frame-picker-heading">
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 id="frame-picker-heading" className="font-semibold text-lg">Generate Creative</h2>
              <p className="text-sm text-text-muted">Select frames to generate ad copy variants.</p>
            </div>
            {selectedFrameIds.size > 0 && (
              <button
                onClick={generateForSelected}
                className="btn-primary"
              >
                Generate Creative ({selectedFrameIds.size} frame{selectedFrameIds.size !== 1 ? 's' : ''})
              </button>
            )}
          </div>
          <FramePickerPanel
            frames={frames}
            selected={selectedFrameIds}
            onToggle={(id) => setSelectedFrameIds(prev => {
              const next = new Set(prev)
              next.has(id) ? next.delete(id) : next.add(id)
              return next
            })}
            frameJobs={frameJobs}
          />
        </div>
      </section>

      {/* Creative review — show frames that have a running job or existing variants */}
      {frames
        .filter(frame => frameJobs[frame.frame_id])
        .map(frame => (
          <CreativeReviewPanel
            key={frame.frame_id}
            frame={frame}
            jobId={frameJobs[frame.frame_id] ?? null}
            onComplete={() => onVariantsGenerated(frame.frame_id)}
            onReviewed={() => qc.invalidateQueries({ queryKey: ['variants', frame.frame_id] })}
          />
        ))}

    </div>
  )
}
