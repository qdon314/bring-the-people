# Phase 3: Run, Results, and Memo Tabs Implementation Plan

Covers Steps 8–10 from the build order: the Experiments (Run) tab, the Results + Decisions tab, and the Memo tab.

**Parent design**: [`docs/plans/2026-02-23-phase3-dashboard.md`](2026-02-23-phase3-dashboard.md)
**Prerequisite**: [`docs/plans/2026-02-23-phase3-plan-create-tabs.md`](2026-02-23-phase3-plan-create-tabs.md) (Plan + Create tabs complete)

---

## Task 25: Utility — UTM Generation

**File**: [`frontend/lib/utils/utm.ts`](../../frontend/lib/utils/utm.ts)

Mirrors the backend taxonomy from [`docs/plans/2026-02-23-growth-system-design.md`](2026-02-22-growth-system-design.md):

```ts
import { format } from 'date-fns'
import type { Show } from '../types'

export interface UTMBundle {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  utm_content: string
  utm_term: string
  full_url: string
}

const PLATFORM_SOURCE: Record<string, string> = {
  meta: 'meta',
  instagram: 'instagram',
  tiktok: 'tiktok',
  email: 'email',
  reddit: 'reddit',
  youtube: 'youtube',
}

const PLATFORM_MEDIUM: Record<string, string> = {
  meta: 'paid_social',
  instagram: 'paid_social',
  tiktok: 'paid_social',
  email: 'email',
  reddit: 'paid_social',
  youtube: 'paid_social',
}

export function buildUTM(params: {
  show: Show
  experimentId: string
  variantId: string
  platform: string
  segmentId: string
}): UTMBundle {
  const source = PLATFORM_SOURCE[params.platform] ?? params.platform
  const medium = PLATFORM_MEDIUM[params.platform] ?? 'paid_social'
  const date = format(new Date(params.show.show_time), 'yyyyMMdd')
  const city = params.show.city.toLowerCase().replace(/\s+/g, '_')

  const bundle: UTMBundle = {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: `show_${city}_${date}`,
    utm_content: `exp_${params.experimentId}_var_${params.variantId}`,
    utm_term: `segment_${params.segmentId}`,
    full_url: '',
  }

  const baseUrl = params.show.ticket_base_url
  if (baseUrl) {
    const url = new URL(baseUrl)
    Object.entries(bundle).forEach(([k, v]) => {
      if (k !== 'full_url') url.searchParams.set(k, v)
    })
    bundle.full_url = url.toString()
  }

  return bundle
}

export function buildAdSetName(params: {
  show: Show
  platform: string
  segmentId: string
  experimentId: string
}): string {
  const date = format(new Date(params.show.show_time), 'yyyyMMdd')
  const city = params.show.city.toLowerCase().replace(/\s+/g, '_')
  return `${params.platform}_${city}_${date}_seg${params.segmentId.slice(0, 8)}_${params.experimentId.slice(0, 8)}`
}
```

---

## Task 26: Utility — Client-Side Metrics

**File**: [`frontend/lib/utils/metrics.ts`](../../frontend/lib/utils/metrics.ts)

Used for live preview on the Results entry form. Canonical values come from the backend `/metrics` endpoint.

```ts
import type { Observation } from '../types'

export interface ComputedMetrics {
  total_spend_usd: number
  total_revenue_usd: number
  total_clicks: number
  total_impressions: number
  total_purchases: number
  ctr: number | null
  cpc_usd: number | null
  cpa_usd: number | null
  roas: number | null
  conversion_rate: number | null
}

export function computeMetrics(observations: Observation[]): ComputedMetrics {
  const totals = observations.reduce(
    (acc, obs) => ({
      spend: acc.spend + obs.spend_cents,
      revenue: acc.revenue + obs.revenue_cents,
      clicks: acc.clicks + obs.clicks,
      impressions: acc.impressions + obs.impressions,
      purchases: acc.purchases + obs.purchases,
    }),
    { spend: 0, revenue: 0, clicks: 0, impressions: 0, purchases: 0 }
  )

  return {
    total_spend_usd: totals.spend / 100,
    total_revenue_usd: totals.revenue / 100,
    total_clicks: totals.clicks,
    total_impressions: totals.impressions,
    total_purchases: totals.purchases,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    cpc_usd: totals.clicks > 0 ? (totals.spend / 100) / totals.clicks : null,
    cpa_usd: totals.purchases > 0 ? (totals.spend / 100) / totals.purchases : null,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : null,
    conversion_rate: totals.clicks > 0 ? totals.purchases / totals.clicks : null,
  }
}

// For preview while user is typing (partial form data)
export function computePreviewMetrics(input: {
  spend_usd: number
  impressions: number
  clicks: number
  purchases: number
  revenue_usd: number
}): ComputedMetrics {
  return computeMetrics([{
    observation_id: '',
    experiment_id: '',
    window_start: '',
    window_end: '',
    spend_cents: Math.round(input.spend_usd * 100),
    revenue_cents: Math.round(input.revenue_usd * 100),
    clicks: input.clicks,
    impressions: input.impressions,
    purchases: input.purchases,
    sessions: 0,
    checkouts: 0,
    refunds: 0,
    refund_cents: 0,
    complaints: 0,
    negative_comment_rate: null,
    attribution_model: 'last_click_utm',
  }])
}
```

---

## Task 27: Run Tab — Experiments Page

**File**: [`frontend/app/shows/[show_id]/run/page.tsx`](../../frontend/app/shows/[show_id]/run/page.tsx)

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useVariants } from '@/lib/hooks/useVariants'
import { useCycles } from '@/lib/hooks/useCycles'
import { ExperimentBuilderForm } from '@/components/experiments/ExperimentBuilderForm'
import { ExperimentCard } from '@/components/experiments/ExperimentCard'

export default function RunPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()
  const [showBuilder, setShowBuilder] = useState(false)
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id
  const { data: experiments } = useExperiments(show_id)
  const cycleExperiments = experiments?.filter(e => e.cycle_id === currentCycleId) ?? []

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

      {/* Header + new experiment button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Experiments</h3>
          <p className="text-sm text-text-muted">Build experiments from approved creative; mark launched when ads are live.</p>
        </div>
        <button onClick={() => setShowBuilder(v => !v)} className="btn-primary">
          {showBuilder ? 'Cancel' : '+ New Experiment'}
        </button>
      </div>

      {/* Builder (collapsible) */}
      {showBuilder && (
        <ExperimentBuilderForm
          showId={show_id}
          cycleId={currentCycleId ?? null}
          onCreated={() => {
            setShowBuilder(false)
            qc.invalidateQueries({ queryKey: ['experiments', show_id] })
          }}
        />
      )}

      {/* Experiments list */}
      {cycleExperiments.length === 0 && !showBuilder && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-lg font-medium mb-2">No experiments yet</p>
          <p className="text-sm">Build an experiment from approved creative to get started.</p>
        </div>
      )}

      {cycleExperiments.map(exp => (
        <ExperimentCard
          key={exp.experiment_id}
          experiment={exp}
          showId={show_id}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['experiments', show_id] })}
        />
      ))}

    </div>
  )
}
```

---

## Task 28: ExperimentBuilderForm Component

**File**: [`frontend/components/experiments/ExperimentBuilderForm.tsx`](../../frontend/components/experiments/ExperimentBuilderForm.tsx)

```tsx
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
        cycle_id: cycleId ?? undefined,
        segment_id: data.segment_id,
        frame_id: data.frame_id,
        channel: data.channel,
        objective: data.objective,
        budget_cap_cents: Math.round(data.budget_usd * 100),
        baseline_snapshot: {},
      })
      // Auto-submit and auto-approve (solo producer flow)
      await experimentsApi.submit(exp.experiment_id)
      await experimentsApi.approve(exp.experiment_id, { approved: true })
      return exp
    },
    onSuccess: onCreated,
  })

  return (
    <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
      <h4 className="font-semibold">New Experiment</h4>

      <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
        {/* Segment */}
        <FormField label="Audience Segment">
          <select {...form.register('segment_id')} className="select w-full">
            <option value="">Select segment…</option>
            {(segments ?? [])
              .filter(s => s.review_status === 'approved')
              .map(s => <option key={s.segment_id} value={s.segment_id}>{s.name}</option>)}
          </select>
        </FormField>

        {/* Frame (filtered by selected segment) */}
        {selectedSegmentId && (
          <FormField label="Creative Frame">
            <select {...form.register('frame_id')} className="select w-full">
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
          <FormField label="Creative Variant">
            <select {...form.register('variant_id')} className="select w-full">
              <option value="">Select variant…</option>
              {approvedVariants.map(v => (
                <option key={v.variant_id} value={v.variant_id}>
                  {v.hook.slice(0, 60)}…
                </option>
              ))}
            </select>
            {approvedVariants.length === 0 && (
              <p className="text-xs text-warning mt-1">No approved variants for this frame.</p>
            )}
          </FormField>
        )}

        {/* Channel */}
        <FormField label="Platform / Channel">
          <select {...form.register('channel')} className="select w-full">
            <option value="">Select…</option>
            {['meta', 'instagram', 'tiktok', 'reddit', 'email', 'youtube'].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </FormField>

        {/* Budget */}
        <FormField label="Budget cap (USD)">
          <input {...form.register('budget_usd')} type="number" step="1" className="input w-full"
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
```

---

## Task 29: UTMPreview + CopyBlock Components

### UTMPreview

**File**: [`frontend/components/experiments/UTMPreview.tsx`](../../frontend/components/experiments/UTMPreview.tsx)

```tsx
import type { UTMBundle } from '@/lib/utils/utm'

export function UTMPreview({ utm, adSetName }: { utm: UTMBundle; adSetName: string }) {
  return (
    <div className="bg-bg rounded-lg p-4 space-y-3">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">UTM Parameters</h5>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {Object.entries(utm).filter(([k]) => k !== 'full_url').map(([k, v]) => (
          <div key={k}>
            <span className="text-text-muted">{k}</span>
            <br />
            <span className="text-text">{String(v)}</span>
          </div>
        ))}
      </div>
      {utm.full_url && (
        <div>
          <p className="text-xs text-text-muted mb-1">Full URL</p>
          <div className="flex items-start gap-2">
            <code className="text-xs bg-surface px-2 py-1 rounded break-all flex-1">{utm.full_url}</code>
            <CopyButton text={utm.full_url} />
          </div>
        </div>
      )}
      {adSetName && (
        <div>
          <p className="text-xs text-text-muted mb-1">Ad set name</p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-surface px-2 py-1 rounded flex-1">{adSetName}</code>
            <CopyButton text={adSetName} />
          </div>
        </div>
      )}
    </div>
  )
}
```

### CopyBlock

**File**: [`frontend/components/experiments/CopyBlock.tsx`](../../frontend/components/experiments/CopyBlock.tsx)

```tsx
import type { Variant } from '@/lib/types'
import type { UTMBundle } from '@/lib/utils/utm'

export function CopyBlock({ variant, utm }: { variant: Variant; utm: UTMBundle }) {
  const text = [
    `HOOK: ${variant.hook}`,
    ``,
    `BODY: ${variant.body}`,
    ``,
    `CTA: ${variant.cta}`,
    utm.full_url ? `\nURL: ${utm.full_url}` : '',
  ].join('\n')

  return (
    <div className="bg-bg rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Copy Pack</h5>
        <CopyButton text={text} label="Copy all" />
      </div>
      <pre className="text-xs whitespace-pre-wrap text-text font-mono bg-surface rounded p-3">{text}</pre>
    </div>
  )
}
```

### CopyButton (shared)

**File**: [`frontend/components/shared/CopyButton.tsx`](../../frontend/components/shared/CopyButton.tsx)

```tsx
'use client'
import { useState } from 'react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="text-xs text-primary hover:underline shrink-0"
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}
```

---

## Task 30: ExperimentCard Component

**File**: [`frontend/components/experiments/ExperimentCard.tsx`](../../frontend/components/experiments/ExperimentCard.tsx)

Displays a single experiment row with its current status, latest metrics, and action buttons.

```tsx
'use client'
import { useMutation } from '@tanstack/react-query'
import { experimentsApi } from '@/lib/api/experiments'
import { useSegments } from '@/lib/hooks/useSegments'
import { useFrames } from '@/lib/hooks/useFrames'
import { useObservations } from '@/lib/hooks/useObservations'
import { useExperimentMetrics } from '@/lib/hooks/useExperimentMetrics'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { UTMPreview } from './UTMPreview'
import { CopyBlock } from './CopyBlock'
import { buildUTM, buildAdSetName } from '@/lib/utils/utm'
import { useShow } from '@/lib/hooks/useShow'
import { useState } from 'react'
import type { Experiment } from '@/lib/types'

interface Props {
  experiment: Experiment
  showId: string
  onUpdated: () => void
}

export function ExperimentCard({ experiment, showId, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { data: show } = useShow(showId)
  const { data: metrics } = useExperimentMetrics(experiment.experiment_id)

  const utmBundle = show ? buildUTM({
    show,
    experimentId: experiment.experiment_id,
    variantId: experiment.frame_id,  // closest proxy — variant id needs to come from first variant
    platform: experiment.channel,
    segmentId: experiment.segment_id,
  }) : null

  const startMutation = useMutation({
    mutationFn: () => experimentsApi.start(experiment.experiment_id),
    onSuccess: onUpdated,
  })

  const stopMutation = useMutation({
    mutationFn: () => experimentsApi.stop(experiment.experiment_id),
    onSuccess: onUpdated,
  })

  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Row summary */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">
                {experiment.channel} experiment
              </h4>
              <ChannelBadge channel={experiment.channel} />
            </div>
            <p className="text-xs text-text-muted font-mono">{experiment.experiment_id.slice(0, 8)}</p>
          </div>
          <StatusBadge status={experiment.status} />
        </div>

        {/* Metrics row */}
        {metrics && (
          <div className="flex items-center gap-6 text-xs text-text-muted mb-3">
            <span>Budget: <span className="font-medium text-text">${(experiment.budget_cap_cents / 100).toFixed(0)}</span></span>
            <span>Spend: <span className="font-medium text-text">${metrics.total_spend_usd.toFixed(0)}</span></span>
            <span>Clicks: <span className="font-medium text-text">{metrics.total_clicks}</span></span>
            <span>Purchases: <span className="font-medium text-text">{metrics.total_purchases}</span></span>
            {metrics.cpa_usd && <span>CPA: <span className="font-medium text-text">${metrics.cpa_usd.toFixed(2)}</span></span>}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {experiment.status === 'approved' && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-success text-xs py-1 px-3"
            >
              Mark Launched
            </button>
          )}
          {experiment.status === 'running' && (
            <button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="btn-ghost text-xs py-1 px-3"
            >
              Stop
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-primary hover:underline ml-auto"
          >
            {expanded ? 'Hide detail ▴' : 'Show detail ▾'}
          </button>
        </div>
      </div>

      {/* Expanded: UTMs + copy pack */}
      {expanded && utmBundle && (
        <div className="border-t border-border p-5 space-y-4">
          <UTMPreview utm={utmBundle} adSetName={show ? buildAdSetName({
            show,
            platform: experiment.channel,
            segmentId: experiment.segment_id,
            experimentId: experiment.experiment_id,
          }) : ''} />
        </div>
      )}
    </div>
  )
}
```

---

## Task 31: Results Tab — Results + Decisions Page

**File**: [`frontend/app/shows/[show_id]/results/page.tsx`](../../frontend/app/shows/[show_id]/results/page.tsx)

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useDecisions } from '@/lib/hooks/useDecisions'
import { useCycles } from '@/lib/hooks/useCycles'
import { ResultsEntryForm } from '@/components/results/ResultsEntryForm'
import { DecisionBadge } from '@/components/results/DecisionBadge'
import { decisionsApi } from '@/lib/api/decisions'
import { useMutation } from '@tanstack/react-query'

export default function ResultsPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id
  const { data: experiments } = useExperiments(show_id)
  const cycleExperiments = experiments?.filter(e =>
    e.cycle_id === currentCycleId && ['running', 'completed'].includes(e.status)
  ) ?? []

  const [sortKey, setSortKey] = useState<'cpa' | 'purchases' | 'ctr'>('cpa')

  if (cycleExperiments.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-16 text-center text-text-muted">
        <p className="text-lg font-medium mb-2">No running experiments</p>
        <p className="text-sm">Launch experiments on the Run tab first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

      {/* Sort controls */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">Sort by:</p>
        {(['cpa', 'purchases', 'ctr'] as const).map(k => (
          <button key={k} onClick={() => setSortKey(k)}
            className={`text-sm px-3 py-1 rounded-lg ${sortKey === k ? 'bg-primary-light text-primary font-semibold' : 'text-text-muted hover:bg-bg'}`}>
            {k === 'cpa' ? 'Best CPA' : k === 'purchases' ? 'Most purchases' : 'Highest CTR'}
          </button>
        ))}
      </div>

      {/* Per-experiment results entry + decision */}
      {cycleExperiments.map(exp => (
        <ExperimentResultsRow
          key={exp.experiment_id}
          experimentId={exp.experiment_id}
          showId={show_id}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ['experiments', show_id] })
            qc.invalidateQueries({ queryKey: ['decisions', exp.experiment_id] })
          }}
        />
      ))}

    </div>
  )
}
```

`ExperimentResultsRow` sub-component (inline or separate file):

```tsx
function ExperimentResultsRow({ experimentId, showId, onUpdated }) {
  const { data: metrics } = useExperimentMetrics(experimentId)
  const { data: decisions } = useDecisions(experimentId)
  const latestDecision = decisions?.[decisions.length - 1]

  const decisionMutation = useMutation({
    mutationFn: () => decisionsApi.evaluate(experimentId),
    onSuccess: onUpdated,
  })

  const [showForm, setShowForm] = useState(false)

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {/* Metrics summary */}
      {metrics && (
        <div className="grid grid-cols-5 gap-4 mb-4">
          <MetricCell label="Spend" value={`$${metrics.total_spend_usd.toFixed(0)}`} />
          <MetricCell label="Clicks" value={metrics.total_clicks.toLocaleString()} />
          <MetricCell label="Purchases" value={metrics.total_purchases.toString()} />
          <MetricCell label="CPA" value={metrics.cpa_usd ? `$${metrics.cpa_usd.toFixed(2)}` : '—'} />
          <MetricCell label="ROAS" value={metrics.roas ? `${metrics.roas.toFixed(2)}x` : '—'} />
        </div>
      )}

      {/* Evidence warning */}
      {metrics && !metrics.evidence_sufficient && (
        <div className="text-xs text-warning bg-warning-light rounded px-2 py-1 mb-3 inline-block">
          ⚠ Low data — fewer than minimum clicks or observation windows
        </div>
      )}

      {/* Decision badge */}
      {latestDecision && (
        <div className="mb-3">
          <DecisionBadge decision={latestDecision} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => setShowForm(v => !v)} className="btn-ghost text-sm">
          {showForm ? 'Hide form' : 'Enter Results'}
        </button>
        <button
          onClick={() => decisionMutation.mutate()}
          disabled={decisionMutation.isPending}
          className="btn-primary text-sm"
        >
          {decisionMutation.isPending ? 'Evaluating…' : 'Run Decision Engine'}
        </button>
      </div>

      {showForm && (
        <div className="mt-4">
          <ResultsEntryForm
            experimentId={experimentId}
            onSaved={() => {
              setShowForm(false)
              onUpdated()
            }}
          />
        </div>
      )}
    </div>
  )
}
```

---

## Task 32: ResultsEntryForm Component

**File**: [`frontend/components/results/ResultsEntryForm.tsx`](../../frontend/components/results/ResultsEntryForm.tsx)

```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { observationsApi } from '@/lib/api/observations'
import { computePreviewMetrics } from '@/lib/utils/metrics'
import { format, subDays } from 'date-fns'

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
})

type FormData = z.infer<typeof schema>

interface Props {
  experimentId: string
  onSaved: () => void
}

export function ResultsEntryForm({ experimentId, onSaved }: Props) {
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
      attribution_model: 'last_click_utm',
    }),
    onSuccess: onSaved,
  })

  return (
    <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Window start">
          <input {...form.register('window_start')} type="datetime-local" className="input text-sm" />
        </FormField>
        <FormField label="Window end">
          <input {...form.register('window_end')} type="datetime-local" className="input text-sm" />
        </FormField>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FormField label="Spend ($)">
          <input {...form.register('spend_usd')} type="number" step="0.01" className="input text-sm" />
        </FormField>
        <FormField label="Impressions">
          <input {...form.register('impressions')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Clicks">
          <input {...form.register('clicks')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Purchases">
          <input {...form.register('purchases')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Revenue ($)">
          <input {...form.register('revenue_usd')} type="number" step="0.01" className="input text-sm" />
        </FormField>
        <FormField label="Refunds">
          <input {...form.register('refunds')} type="number" className="input text-sm" />
        </FormField>
        <FormField label="Complaints">
          <input {...form.register('complaints')} type="number" className="input text-sm" />
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

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-muted">{label}</p>
      <p className="font-semibold text-text">{value}</p>
    </div>
  )
}
```

---

## Task 33: DecisionBadge Component

**File**: [`frontend/components/results/DecisionBadge.tsx`](../../frontend/components/results/DecisionBadge.tsx)

```tsx
import type { Decision } from '@/lib/types'
import { useState } from 'react'

export function DecisionBadge({ decision }: { decision: Decision }) {
  const [expanded, setExpanded] = useState(false)
  const conf = Math.round(decision.confidence * 100)

  return (
    <div>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2"
      >
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
          decision.action === 'scale' ? 'bg-success-light text-success' :
          decision.action === 'hold' ? 'bg-warning-light text-warning' :
          'bg-danger-light text-danger'
        }`}>
          {decision.action.toUpperCase()}
        </span>
        <span className="text-xs text-text-muted">{conf}% confidence</span>
        <span className="text-xs text-text-muted">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div className="mt-2 p-3 bg-bg rounded-lg text-sm space-y-2">
          <p className="text-text">{decision.rationale}</p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {Object.entries(decision.metrics_snapshot).slice(0, 6).map(([k, v]) => (
              <div key={k}>
                <p className="text-text-muted">{k.replace(/_/g, ' ')}</p>
                <p className="font-mono font-medium">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Task 34: Memo Tab

**File**: [`frontend/app/shows/[show_id]/memo/page.tsx`](../../frontend/app/shows/[show_id]/memo/page.tsx)

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemos } from '@/lib/hooks/useMemos'
import { useCycles } from '@/lib/hooks/useCycles'
import { memosApi } from '@/lib/api/memos'
import { AgentRunButton } from '@/components/shared/AgentRunButton'
import { MemoView } from '@/components/memo/MemoView'
import { format, subDays } from 'date-fns'

export default function MemoPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const qc = useQueryClient()
  const { data: cycles } = useCycles(show_id)
  const { data: memos } = useMemos(show_id)
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null)

  const currentCycle = cycles?.[0]
  const [cycleStart, setCycleStart] = useState(
    currentCycle?.started_at
      ? format(new Date(currentCycle.started_at), "yyyy-MM-dd'T'HH:mm")
      : format(subDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm")
  )
  const [cycleEnd, setCycleEnd] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))

  const selectedMemo = memos?.find(m => m.memo_id === selectedMemoId) ??
    (memos?.length ? memos[memos.length - 1] : null)

  function onMemoGenerated(job: unknown) {
    qc.invalidateQueries({ queryKey: ['memos', show_id] })
    const result = (job as any).result_json
    if (result?.memo_id) setSelectedMemoId(result.memo_id)
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Generate panel + past memos list */}
        <div className="space-y-5">
          {/* Generate */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-3">Generate Memo</h3>
            <div className="space-y-3 mb-4">
              <FormField label="Cycle start">
                <input type="datetime-local" value={cycleStart}
                  onChange={e => setCycleStart(e.target.value)} className="input text-sm w-full" />
              </FormField>
              <FormField label="Cycle end">
                <input type="datetime-local" value={cycleEnd}
                  onChange={e => setCycleEnd(e.target.value)} className="input text-sm w-full" />
              </FormField>
            </div>
            <AgentRunButton
              label="Generate Memo"
              onRun={() => memosApi.run(show_id, {
                cycle_start: new Date(cycleStart).toISOString(),
                cycle_end: new Date(cycleEnd).toISOString(),
              })}
              onComplete={onMemoGenerated}
            />
          </div>

          {/* Past memos */}
          {memos && memos.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-3">Past Memos</h4>
              <ul className="space-y-1">
                {memos.map(memo => (
                  <li key={memo.memo_id}>
                    <button
                      onClick={() => setSelectedMemoId(memo.memo_id)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        selectedMemo?.memo_id === memo.memo_id
                          ? 'bg-primary-light text-primary font-medium'
                          : 'hover:bg-bg text-text-muted'
                      }`}
                    >
                      {format(new Date(memo.cycle_start), 'MMM d')} – {format(new Date(memo.cycle_end), 'MMM d, yyyy')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Memo content */}
        <div className="lg:col-span-2">
          {selectedMemo ? (
            <MemoView memo={selectedMemo} />
          ) : (
            <div className="bg-surface border border-border rounded-lg p-12 text-center text-text-muted">
              <p className="text-lg font-medium mb-2">No memo yet</p>
              <p className="text-sm">Generate a memo after running the decision engine.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
```

---

## Task 35: MemoView Component

**File**: [`frontend/components/memo/MemoView.tsx`](../../frontend/components/memo/MemoView.tsx)

```tsx
import ReactMarkdown from 'react-markdown'
import { CopyButton } from '@/components/shared/CopyButton'
import { format } from 'date-fns'
import type { ProducerMemo } from '@/lib/types'

export function MemoView({ memo }: { memo: ProducerMemo }) {
  return (
    <div className="bg-surface border border-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="font-semibold">Producer Memo</h3>
          <p className="text-sm text-text-muted">
            {format(new Date(memo.cycle_start), 'MMM d')} – {format(new Date(memo.cycle_end), 'MMM d, yyyy')}
          </p>
        </div>
        <CopyButton text={memo.markdown} label="Copy Markdown" />
      </div>

      {/* Rendered markdown */}
      <div className="p-6 prose prose-sm max-w-none
        prose-headings:font-semibold prose-headings:text-text
        prose-p:text-text prose-p:leading-relaxed
        prose-strong:text-text
        prose-ul:text-text prose-li:text-text
        prose-code:font-mono prose-code:text-sm prose-code:bg-bg prose-code:px-1 prose-code:rounded">
        <ReactMarkdown>{memo.markdown}</ReactMarkdown>
      </div>
    </div>
  )
}
```

Add Tailwind typography plugin:
```bash
npm install @tailwindcss/typography
```

Add to `tailwind.config.ts` plugins:
```ts
plugins: [require('@tailwindcss/typography')]
```

---

## Summary: Files Created in This Plan

### Frontend
| File | Purpose |
|------|---------|
| `frontend/lib/utils/utm.ts` | UTM bundle generation |
| `frontend/lib/utils/metrics.ts` | Client-side metrics computation |
| `frontend/app/shows/[show_id]/run/page.tsx` | Run tab |
| `frontend/components/experiments/ExperimentBuilderForm.tsx` | Experiment creation form |
| `frontend/components/experiments/UTMPreview.tsx` | UTM params + full URL display |
| `frontend/components/experiments/CopyBlock.tsx` | Copyable ad copy pack |
| `frontend/components/experiments/ExperimentCard.tsx` | Experiment row with actions |
| `frontend/components/shared/CopyButton.tsx` | One-click copy button |
| `frontend/app/shows/[show_id]/results/page.tsx` | Results tab |
| `frontend/components/results/ResultsEntryForm.tsx` | Observation entry with live preview |
| `frontend/components/results/DecisionBadge.tsx` | Decision display with expandable detail |
| `frontend/app/shows/[show_id]/memo/page.tsx` | Memo tab |
| `frontend/components/memo/MemoView.tsx` | Rendered markdown memo |
