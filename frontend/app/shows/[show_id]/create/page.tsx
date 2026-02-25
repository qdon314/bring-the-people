'use client'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useFrames } from '@/lib/hooks/useFrames'
import { useCycles } from '@/lib/hooks/useCycles'
import { creativeApi } from '@/lib/api/creative'
import { variantsApi } from '@/lib/api/variants'
import { FramePickerPanel } from '@/components/creative/FramePickerPanel'
import { CreativeReviewPanel } from '@/components/creative/CreativeReviewPanel'

export default function CreatePage() {
  const { show_id } = useParams<{ show_id: string }>()
  const searchParams = useSearchParams()
  const preselectedFrameId = searchParams.get('frame_id')

  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id

  const { data: frames, isLoading: framesLoading } = useFrames(show_id, currentCycleId)

  // Frame selection state — default to preselected if coming from Plan tab
  const [selectedFrameIds, setSelectedFrameIds] = useState<Set<string>>(
    preselectedFrameId ? new Set([preselectedFrameId]) : new Set()
  )

  // Track active jobs per frame
  const [frameJobs, setFrameJobs] = useState<Record<string, string>>({})  // frameId → jobId
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const variantQueries = useQueries({
    queries: (frames ?? []).map((frame) => ({
      queryKey: ['variants', frame.frame_id],
      queryFn: () => variantsApi.list(frame.frame_id),
      enabled: !!frame.frame_id,
    })),
  })

  const variantsCountByFrameId = useMemo(() => {
    const map = new Map<string, number>()
    ;(frames ?? []).forEach((frame, idx) => {
      map.set(frame.frame_id, variantQueries[idx]?.data?.length ?? 0)
    })
    return map
  }, [frames, variantQueries])

  const framesWithVariants = useMemo(
    () => (frames ?? []).filter((frame) => (variantsCountByFrameId.get(frame.frame_id) ?? 0) > 0),
    [frames, variantsCountByFrameId]
  )

  const reviewFrameIds = useMemo(() => {
    const ids = new Set<string>(Array.from(selectedFrameIds))
    Object.keys(frameJobs).forEach((id) => ids.add(id))
    framesWithVariants.forEach((frame) => ids.add(frame.frame_id))
    return ids
  }, [selectedFrameIds, frameJobs, framesWithVariants])

  async function generateForSelected() {
    const selectedIds = Array.from(selectedFrameIds)
    if (selectedIds.length === 0) return
    setIsGenerating(true)
    setGenerationError(null)
    const results = await Promise.allSettled(
      selectedIds.map(async (frameId) => {
        const { job_id } = await creativeApi.run(frameId)
        setFrameJobs(prev => ({ ...prev, [frameId]: job_id }))
      })
    )
    const failed = results
      .map((result, index) => ({ result, frameId: selectedIds[index] }))
      .filter((entry) => entry.result.status === 'rejected')
      .map((entry) => entry.frameId.slice(0, 8))
    if (failed.length > 0) {
      setGenerationError(`Could not start generation for ${failed.length} frame(s): ${failed.join(', ')}`)
    }
    setIsGenerating(false)
  }

  function onVariantsGenerated(frameId: string) {
    qc.invalidateQueries({ queryKey: ['variants', frameId] })
  }

  if (framesLoading) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 text-center text-text-muted">
        <p className="text-lg font-medium mb-2">Loading frames…</p>
      </div>
    )
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
              <p className="text-sm text-text-muted">
                Select frames to generate ad copy variants. Existing variants are loaded automatically.
              </p>
            </div>
            <button
              onClick={generateForSelected}
              disabled={selectedFrameIds.size === 0 || isGenerating}
              className="btn-primary"
            >
              {isGenerating
                ? 'Starting…'
                : `Generate Creative (${selectedFrameIds.size} frame${selectedFrameIds.size !== 1 ? 's' : ''})`}
            </button>
          </div>
          {generationError && (
            <p className="text-sm text-danger mb-4">{generationError}</p>
          )}
          {framesWithVariants.length > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-success-light px-3 py-2">
              <p className="text-sm text-success">
                Variants ready on {framesWithVariants.length} frame{framesWithVariants.length !== 1 ? 's' : ''}.
              </p>
              <Link href={`/shows/${show_id}/run`} className="text-sm font-medium text-success hover:underline">
                Continue to Run →
              </Link>
            </div>
          )}
          <FramePickerPanel
            frames={frames}
            selected={selectedFrameIds}
            onToggle={(id) => setSelectedFrameIds(prev => {
              const next = new Set(prev)
              next.has(id) ? next.delete(id) : next.add(id)
              return next
            })}
            frameJobs={frameJobs}
            disabled={isGenerating}
          />
        </div>
      </section>

      {/* Creative review — show selected, active, and previously generated frames */}
      {frames
        .filter((frame) => reviewFrameIds.has(frame.frame_id))
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
