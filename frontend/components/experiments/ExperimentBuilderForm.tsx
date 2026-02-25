'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useVariants } from '@/lib/hooks/useVariants'
import { useShow } from '@/lib/hooks/useShow'
import { experimentsApi } from '@/lib/api/experiments'
import { buildUTM, buildAdSetName } from '@/lib/utils/utm'
import { UTMPreview } from './UTMPreview'
import { CopyBlock } from './CopyBlock'
import { FormField } from '@/components/shared/FormField'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

const schema = z.object({
  segment_id: z.string().uuid(),
  frame_id: z.string().uuid(),
  variant_id: z.string().uuid(),
  channel: z.string().min(1),
  budget_usd: z.coerce.number().positive(),
  objective: z.string().default('ticket_sales'),
})

type FormData = z.infer<typeof schema>

interface Props {
  showId: string
  cycleId: string | null
  onCreated: () => void
}

export function ExperimentBuilderForm({ showId, cycleId, onCreated }: Props) {
  const { data: show } = useShow(showId)
  const { data: segments } = useSegments(showId, cycleId ?? undefined)
  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const selectedSegmentId = form.watch('segment_id')
  const selectedFrameId = form.watch('frame_id')
  const selectedVariantId = form.watch('variant_id')
  const selectedChannel = form.watch('channel')

  const { data: frames } = useFrames(showId, cycleId ?? undefined)
  const segmentFrames = frames?.filter(f => f.segment_id === selectedSegmentId && f.review_status === 'approved') ?? []

  const { data: variants } = useVariants(selectedFrameId ?? null)
  const approvedVariants = variants?.filter(v => v.review_status === 'approved') ?? []

  // UTM preview (computed from form values + show)
  const utm = show && selectedVariantId && selectedSegmentId ? buildUTM({
    show,
    experimentId: 'preview',
    variantId: selectedVariantId,
    platform: selectedChannel,
    segmentId: selectedSegmentId,
  }) : null

  // Selected variant copy
  const selectedVariant = approvedVariants.find(v => v.variant_id === selectedVariantId)

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const exp = await experimentsApi.create({
        show_id: showId,
        cycle_id: cycleId,
        segment_id: data.segment_id,
        frame_id: data.frame_id,
        channel: data.channel,
        objective: data.objective,
        budget_cap_cents: Math.round(data.budget_usd * 100),
        baseline_snapshot: { selected_variant_id: data.variant_id },
      })
      // Auto-submit and auto-approve (solo producer flow)
      await experimentsApi.submit(exp.experiment_id)
      await experimentsApi.approve(exp.experiment_id, true)
      return exp
    },
    onSuccess: onCreated,
  })

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
      <h4 className="font-semibold">New Experiment</h4>

      <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
        {/* Segment */}
        <FormField
          label="Audience Segment"
          fieldId="segment_id"
          error={form.formState.errors.segment_id?.message}
        >
          <select id="segment_id" {...form.register('segment_id')} className="select w-full">
            <option value="">Select segment…</option>
            {(segments ?? [])
              .filter(s => s.review_status === 'approved')
              .map(s => <option key={s.segment_id} value={s.segment_id}>{s.name}</option>)}
          </select>
        </FormField>

        {/* Frame (filtered by selected segment) */}
        {selectedSegmentId && (
          <FormField
            label="Creative Frame"
            fieldId="frame_id"
            error={form.formState.errors.frame_id?.message}
          >
            <select id="frame_id" {...form.register('frame_id')} className="select w-full">
              <option value="">Select frame…</option>
              {segmentFrames.map(f => (
                <option key={f.frame_id} value={f.frame_id}>
                  [{f.channel}] {f.hypothesis.slice(0, 60)}
                </option>
              ))}
            </select>
            {segmentFrames.length === 0 && (
              <p className="text-xs text-warning mt-1">No approved frames for this segment.</p>
            )}
          </FormField>
        )}

        {/* Variant (filtered by selected frame) */}
        {selectedFrameId && (
          <FormField
            label="Creative Variant"
            fieldId="variant_id"
            error={form.formState.errors.variant_id?.message}
          >
            <select id="variant_id" {...form.register('variant_id')} className="select w-full">
              <option value="">Select variant…</option>
              {approvedVariants.map(v => (
                <option key={v.variant_id} value={v.variant_id}>
                  {v.hook.slice(0, 60)}{v.hook.length > 60 ? '…' : ''}
                </option>
              ))}
            </select>
            {approvedVariants.length === 0 && (
              <p className="text-xs text-warning mt-1">No approved variants for this frame.</p>
            )}
          </FormField>
        )}

        {/* Channel */}
        <FormField
          label="Platform / Channel"
          fieldId="channel"
          error={form.formState.errors.channel?.message}
        >
          <select id="channel" {...form.register('channel')} className="select w-full">
            <option value="">Select…</option>
            {['meta', 'instagram', 'tiktok', 'reddit', 'email', 'youtube'].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </FormField>

        {/* Budget */}
        <FormField
          label="Budget cap (USD)"
          fieldId="budget_usd"
          error={form.formState.errors.budget_usd?.message}
        >
          <input id="budget_usd" {...form.register('budget_usd')} type="number" step="1" className="input w-full"
            placeholder="e.g. 400" />
        </FormField>

        {/* UTM Preview */}
        {utm && selectedVariant && (
          <UTMPreview utm={utm} adSetName={show ? buildAdSetName({
            show, platform: selectedChannel,
            segmentId: selectedSegmentId,
            experimentId: 'preview',
          }) : ''} />
        )}

        {/* Copy pack preview */}
        {selectedVariant && utm && (
          <CopyBlock variant={selectedVariant} utm={utm} />
        )}

        {createMutation.error && (
          <ErrorBanner message={createMutation.error.message} />
        )}

        <div className="flex justify-end gap-2">
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? 'Creating…' : 'Create Experiment'}
          </button>
        </div>
      </form>
    </div>
  )
}
