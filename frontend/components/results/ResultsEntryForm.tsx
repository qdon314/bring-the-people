'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { observationsApi } from '@/lib/api/observations'
import { computePreviewMetrics } from '@/lib/utils/metrics'
import { format, subDays } from 'date-fns'
import { FormField } from '@/components/shared/FormField'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

const schema = z.object({
  window_start: z.string().min(1),
  window_end: z.string().min(1),
  spend_usd: z.coerce.number().min(0),
  impressions: z.coerce.number().int().min(0),
  clicks: z.coerce.number().int().min(0),
  purchases: z.coerce.number().int().min(0),
  revenue_usd: z.coerce.number().min(0).default(0),
  refunds: z.coerce.number().int().min(0).default(0),
  complaints: z.coerce.number().int().min(0).default(0),
}).refine((data) => new Date(data.window_end) > new Date(data.window_start), {
  message: 'Window end must be after window start',
  path: ['window_end'],
})

type FormData = z.infer<typeof schema>

interface Props {
  experimentId: string
  onSaved: () => void
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-muted">{label}</p>
      <p className="font-semibold text-text">{value}</p>
    </div>
  )
}

export function ResultsEntryForm({ experimentId, onSaved }: Props) {
  const idPrefix = `results-${experimentId.slice(0, 8)}`
  const today = format(new Date(), "yyyy-MM-dd'T'HH:mm")
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm")

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      window_start: weekAgo,
      window_end: today,
      spend_usd: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      revenue_usd: 0,
    }
  })

  // Live preview
  const watched = form.watch()
  const preview = computePreviewMetrics({
    spend_usd: watched.spend_usd ?? 0,
    impressions: watched.impressions ?? 0,
    clicks: watched.clicks ?? 0,
    purchases: watched.purchases ?? 0,
    revenue_usd: watched.revenue_usd ?? 0,
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => observationsApi.create({
      experiment_id: experimentId,
      window_start: new Date(data.window_start).toISOString(),
      window_end: new Date(data.window_end).toISOString(),
      spend_cents: Math.round(data.spend_usd * 100),
      impressions: data.impressions,
      clicks: data.clicks,
      sessions: 0,
      checkouts: 0,
      purchases: data.purchases,
      revenue_cents: Math.round(data.revenue_usd * 100),
      refunds: data.refunds,
      refund_cents: 0,
      complaints: data.complaints,
      negative_comment_rate: null,
      attribution_model: 'last_click_utm',
    }),
    onSuccess: onSaved,
  })

  return (
    <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Window start"
          fieldId={`${idPrefix}-window_start`}
          error={form.formState.errors.window_start?.message}
        >
          <input id={`${idPrefix}-window_start`} {...form.register('window_start')} type="datetime-local" className="input text-sm" />
        </FormField>
        <FormField
          label="Window end"
          fieldId={`${idPrefix}-window_end`}
          error={form.formState.errors.window_end?.message}
        >
          <input id={`${idPrefix}-window_end`} {...form.register('window_end')} type="datetime-local" className="input text-sm" />
        </FormField>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FormField label="Spend ($)" fieldId={`${idPrefix}-spend_usd`} error={form.formState.errors.spend_usd?.message}>
          <input id={`${idPrefix}-spend_usd`} {...form.register('spend_usd')} type="number" step="0.01" className="input text-sm" />
        </FormField>
        <FormField label="Impressions" fieldId={`${idPrefix}-impressions`} error={form.formState.errors.impressions?.message}>
          <input id={`${idPrefix}-impressions`} {...form.register('impressions')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Clicks" fieldId={`${idPrefix}-clicks`} error={form.formState.errors.clicks?.message}>
          <input id={`${idPrefix}-clicks`} {...form.register('clicks')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Purchases" fieldId={`${idPrefix}-purchases`} error={form.formState.errors.purchases?.message}>
          <input id={`${idPrefix}-purchases`} {...form.register('purchases')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Revenue ($)" fieldId={`${idPrefix}-revenue_usd`} error={form.formState.errors.revenue_usd?.message}>
          <input id={`${idPrefix}-revenue_usd`} {...form.register('revenue_usd')} type="number" step="0.01" className="input text-sm" />
        </FormField>
        <FormField label="Refunds" fieldId={`${idPrefix}-refunds`} error={form.formState.errors.refunds?.message}>
          <input id={`${idPrefix}-refunds`} {...form.register('refunds')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Complaints" fieldId={`${idPrefix}-complaints`} error={form.formState.errors.complaints?.message}>
          <input id={`${idPrefix}-complaints`} {...form.register('complaints')} type="number" className="input text-sm" />
        </FormField>
      </div>

      {/* Live preview */}
      <div className="bg-bg rounded-lg p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Preview</p>
        <div className="grid grid-cols-4 gap-3 text-xs">
          <PreviewMetric label="CTR" value={preview.ctr ? `${(preview.ctr * 100).toFixed(2)}%` : '—'} />
          <PreviewMetric label="CPC" value={preview.cpc_usd ? `$${preview.cpc_usd.toFixed(3)}` : '—'} />
          <PreviewMetric label="CPA" value={preview.cpa_usd ? `$${preview.cpa_usd.toFixed(2)}` : '—'} />
          <PreviewMetric label="ROAS" value={preview.roas ? `${preview.roas.toFixed(2)}x` : '—'} />
        </div>
      </div>

      {mutation.error && <ErrorBanner message={mutation.error.message} />}

      <button type="submit" disabled={mutation.isPending} className="btn-primary text-sm">
        {mutation.isPending ? 'Saving…' : 'Save Results'}
      </button>
    </form>
  )
}
