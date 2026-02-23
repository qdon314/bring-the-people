# Phase 3: Overview Page + Polish Implementation Plan

Covers Steps 11–12 from the build order: the Show Overview page (built last, when all cycle semantics are real) and the polish/accessibility pass.

**Parent design**: [`docs/plans/2026-02-23-phase3-dashboard.md`](2026-02-23-phase3-dashboard.md)
**Prerequisite**: [`docs/plans/2026-02-23-phase3-run-results-memo-tabs.md`](2026-02-23-phase3-run-results-memo-tabs.md) (all other tabs complete)

---

## Task 36: Overview Page — Show Overview

**Why last**: The Overview page aggregates data from every other tab. Building it before those tabs are complete means constantly handling edge cases for data that doesn't exist yet. Build it once all the underlying semantics (cycle, segments, experiments, observations, decisions) are real.

**File**: [`frontend/app/shows/[show_id]/overview/page.tsx`](../../frontend/app/shows/[show_id]/overview/page.tsx)

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useShow } from '@/lib/hooks/useShow'
import { useCycles } from '@/lib/hooks/useCycles'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useSegments } from '@/lib/hooks/useSegments'
import { useDecisions } from '@/lib/hooks/useDecisions'
import { useEvents } from '@/lib/hooks/useEvents'
import { KPIStat } from '@/components/shared/KPIStat'
import { NextActionPanel } from '@/components/overview/NextActionPanel'
import { ActivityFeed } from '@/components/overview/ActivityFeed'
import { PastDecisionsPanel } from '@/components/overview/PastDecisionsPanel'
import { ActiveExperimentsPanel } from '@/components/overview/ActiveExperimentsPanel'
import { useExperimentMetrics } from '@/lib/hooks/useExperimentMetrics'

export default function OverviewPage() {
  const { show_id } = useParams<{ show_id: string }>()
  const { data: show } = useShow(show_id)
  const { data: cycles } = useCycles(show_id)
  const currentCycleId = cycles?.[0]?.cycle_id
  const { data: experiments } = useExperiments(show_id)
  const { data: segments } = useSegments(show_id, currentCycleId)
  const { data: events } = useEvents(show_id)

  const runningExperiments = experiments?.filter(e =>
    e.status === 'running' && e.cycle_id === currentCycleId
  ) ?? []

  if (!show) return <OverviewSkeleton />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Next Action Panel */}
        <NextActionPanel
          show={show}
          segments={segments ?? []}
          experiments={experiments ?? []}
          showId={show_id}
          cycleId={currentCycleId ?? null}
        />

        {/* KPI Cards */}
        <KPISection showId={show_id} show={show} runningExperiments={runningExperiments} />

        {/* Two-column: Active experiments + Activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActiveExperimentsPanel experiments={runningExperiments} showId={show_id} />
          </div>
          <div>
            <ActivityFeed events={events ?? []} />
          </div>
        </div>

        {/* Past cycle decisions */}
        <PastDecisionsPanel showId={show_id} experiments={experiments ?? []} />

      </div>
    </div>
  )
}
```

---

## Task 37: KPIStat Component + KPI Section

**File**: [`frontend/components/shared/KPIStat.tsx`](../../frontend/components/shared/KPIStat.tsx)

```tsx
interface KPIStatProps {
  label: string
  value: string
  delta?: string           // e.g. "+12.5%"
  deltaDirection?: 'up' | 'down' | 'neutral'
  subtext?: string
  sparklineValues?: number[]   // for sparkline chart
}

export function KPIStat({ label, value, delta, deltaDirection, subtext, sparklineValues }: KPIStatProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 card-hover">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        {delta && (
          <span className={`inline-flex items-center text-xs font-semibold ${
            deltaDirection === 'up' ? 'text-success' :
            deltaDirection === 'down' ? 'text-danger' :
            'text-text-muted'
          }`}>
            {deltaDirection === 'up' ? '↑' : deltaDirection === 'down' ? '↓' : ''}
            {delta}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <div className="flex items-end justify-between">
        {subtext && <p className="text-xs text-text-muted">{subtext}</p>}
        {sparklineValues && <MiniSparkline values={sparklineValues} />}
      </div>
    </div>
  )
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-8" aria-hidden="true">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary"
          style={{
            height: `${Math.round((v / max) * 100)}%`,
            opacity: i === values.length - 1 ? 1 : 0.4 + (i / values.length) * 0.4,
          }}
        />
      ))}
    </div>
  )
}
```

**KPI Section** (inline in overview or extract to `KPISection.tsx`):

Aggregates data from running experiments to show:
1. **Tickets Sold** — from `show.tickets_sold` + sparkline from ticket velocity (static for now without velocity endpoint)
2. **Cycle Spend** — sum `spend_cents` from all observations in current cycle (fetched from `/metrics` per experiment)
3. **Cost Per Ticket** — total `spend_cents / purchases` across cycle
4. **ROAS** — total `revenue_cents / spend_cents` across cycle

```tsx
function KPISection({ showId, show, runningExperiments }) {
  // Fetch metrics for each running experiment
  const metricsQueries = runningExperiments.map(e =>
    useExperimentMetrics(e.experiment_id)  // batched via React Query
  )

  const allMetrics = metricsQueries.map(q => q.data).filter(Boolean)
  const totals = allMetrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.total_spend_cents,
      purchases: acc.purchases + m.total_purchases,
      revenue: acc.revenue + m.total_revenue_cents,
    }),
    { spend: 0, purchases: 0, revenue: 0 }
  )

  const cpa = totals.purchases > 0 ? totals.spend / totals.purchases / 100 : null
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : null
  const pct = Math.round((show.tickets_sold / show.tickets_total) * 100)

  return (
    <section aria-labelledby="kpi-heading">
      <h3 id="kpi-heading" className="sr-only">Key Performance Indicators</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPIStat
          label="Tickets Sold"
          value={show.tickets_sold.toLocaleString()}
          subtext={`${show.tickets_total - show.tickets_sold} remaining · ${pct}% sold`}
        />
        <KPIStat
          label="Cycle Spend"
          value={`$${(totals.spend / 100).toFixed(0)}`}
          subtext={`${runningExperiments.length} active experiments`}
        />
        <KPIStat
          label="Cost Per Ticket"
          value={cpa ? `$${cpa.toFixed(2)}` : '—'}
          subtext="Across running experiments"
          deltaDirection={cpa && cpa < 20 ? 'up' : cpa && cpa > 30 ? 'down' : 'neutral'}
        />
        <KPIStat
          label="ROAS"
          value={roas ? `${roas.toFixed(2)}x` : '—'}
          subtext={totals.revenue > 0 ? `Revenue: $${(totals.revenue / 100).toFixed(0)}` : undefined}
        />
      </div>
    </section>
  )
}
```

---

## Task 38: NextActionPanel Component

**File**: [`frontend/components/overview/NextActionPanel.tsx`](../../frontend/components/overview/NextActionPanel.tsx)

The next-action logic follows the cycle state machine:

```tsx
import Link from 'next/link'
import type { Show, Segment, Experiment } from '@/lib/types'

type NextAction =
  | { type: 'run_strategy'; label: string; href: string }
  | { type: 'generate_creative'; label: string; href: string }
  | { type: 'build_experiments'; label: string; href: string }
  | { type: 'enter_results'; label: string; href: string }
  | { type: 'run_decisions'; label: string; href: string }
  | { type: 'generate_memo'; label: string; href: string }
  | { type: 'all_done'; label: string; href: string }

function getNextAction(params: {
  showId: string
  segments: Segment[]
  experiments: Experiment[]
  cycleId: string | null
}): NextAction {
  const { showId, segments, experiments, cycleId } = params
  const base = `/shows/${showId}`

  // No segments for current cycle → run strategy
  if (!segments.length) {
    return { type: 'run_strategy', label: 'Run Strategy Agent', href: `${base}/plan` }
  }

  // Segments but no approved frames
  const approvedSegments = segments.filter(s => s.review_status === 'approved')
  if (!approvedSegments.length) {
    return { type: 'run_strategy', label: 'Review and approve segments', href: `${base}/plan` }
  }

  // No experiments in this cycle
  const cycleExperiments = experiments.filter(e => e.cycle_id === cycleId)
  if (!cycleExperiments.length) {
    return { type: 'build_experiments', label: 'Build experiments from approved creative', href: `${base}/run` }
  }

  // Experiments exist but none are running
  const running = cycleExperiments.filter(e => e.status === 'running')
  if (!running.length) {
    return { type: 'enter_results', label: 'Launch experiments and enter results', href: `${base}/run` }
  }

  // Running experiments → enter results
  return { type: 'enter_results', label: 'Enter results for running experiments', href: `${base}/results` }
}

interface Props {
  show: Show
  segments: Segment[]
  experiments: Experiment[]
  showId: string
  cycleId: string | null
}

export function NextActionPanel({ show, segments, experiments, showId, cycleId }: Props) {
  const action = getNextAction({ showId, segments, experiments, cycleId })

  return (
    <section aria-labelledby="next-action-heading">
      <div className="bg-primary-light border border-primary/20 rounded-lg p-5 flex items-center justify-between">
        <div>
          <h3 id="next-action-heading" className="font-semibold text-text mb-1">
            Next: {action.label}
          </h3>
          <p className="text-sm text-text-muted">
            {daysUntilShow(show.show_time) > 0
              ? `${daysUntilShow(show.show_time)} days until show · ${getShowPhaseLabel(daysUntilShow(show.show_time))} phase`
              : 'Show date passed'}
          </p>
        </div>
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors"
        >
          {action.label}
          <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}
```

---

## Task 39: ActivityFeed Component

**File**: [`frontend/components/overview/ActivityFeed.tsx`](../../frontend/components/overview/ActivityFeed.tsx)

Uses the server-provided `display.title` and `display.subtitle` — no client-side event-type mapping needed.

```tsx
import { timeSince } from '@/lib/utils/dates'
import type { DomainEvent } from '@/lib/types'

const EVENT_DOT_COLOR: Record<string, string> = {
  'experiment.launched': 'bg-success',
  'experiment.approved': 'bg-success',
  'decision.issued': 'bg-primary',
  'memo.published': 'bg-accent',
  'strategy.completed': 'bg-accent',
  'creative.completed': 'bg-accent',
}

export function ActivityFeed({ events }: { events: DomainEvent[] }) {
  if (!events.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <p className="text-sm text-text-muted">No activity yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-lg">
      <div className="p-5 border-b border-border">
        <h3 className="font-semibold">Recent Activity</h3>
      </div>
      <div className="p-4">
        <ol className="space-y-4">
          {events.slice(0, 10).map((event, i) => (
            <li key={event.event_id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`w-2 h-2 rounded-full mt-2 shrink-0 ${EVENT_DOT_COLOR[event.type] ?? 'bg-text-muted'}`}
                  aria-hidden="true"
                />
                {i < 9 && <span className="w-px flex-1 bg-border mt-1" aria-hidden="true" />}
              </div>
              <div className="pb-4">
                <p className="text-sm">
                  <span className="font-medium">{event.display.title}</span>
                </p>
                {event.display.subtitle && (
                  <p className="text-xs text-text-muted mt-0.5">{event.display.subtitle}</p>
                )}
                <time className="text-xs text-text-muted">{timeSince(event.at)}</time>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
```

---

## Task 40: PastDecisionsPanel Component

**File**: [`frontend/components/overview/PastDecisionsPanel.tsx`](../../frontend/components/overview/PastDecisionsPanel.tsx)

Shows Scale/Hold/Kill decisions from the most recently completed cycle.

```tsx
import { useDecisions } from '@/lib/hooks/useDecisions'
import type { Experiment } from '@/lib/types'

export function PastDecisionsPanel({ showId, experiments }: { showId: string; experiments: Experiment[] }) {
  // Past cycle = experiments not in current cycle with decisions
  const completedExperiments = experiments.filter(e =>
    ['completed', 'stopped'].includes(e.status)
  )

  if (!completedExperiments.length) return null

  return (
    <section aria-labelledby="decisions-heading">
      <div className="bg-surface border border-border rounded-lg">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 id="decisions-heading" className="font-semibold">Past Cycle Decisions</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {completedExperiments.slice(0, 6).map(exp => (
              <ExperimentDecisionCard key={exp.experiment_id} experimentId={exp.experiment_id} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ExperimentDecisionCard({ experimentId }: { experimentId: string }) {
  const { data: decisions } = useDecisions(experimentId)
  const latest = decisions?.[decisions.length - 1]
  if (!latest) return null

  const styles = {
    scale: { bg: 'bg-success-light', text: 'text-success', dot: 'bg-success' },
    hold: { bg: 'bg-warning-light', text: 'text-warning', dot: 'bg-warning' },
    kill: { bg: 'bg-danger-light', text: 'text-danger', dot: 'bg-danger' },
  }[latest.action]

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${styles.bg}`}>
      <span className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold ${styles.dot}`}>
        {latest.action[0].toUpperCase()}
      </span>
      <div>
        <p className={`text-sm font-semibold ${styles.text}`}>
          {latest.action.charAt(0).toUpperCase() + latest.action.slice(1)}
        </p>
        <p className="text-xs text-text-muted">
          {latest.metrics_snapshot.cac_cents
            ? `CPA $${(Number(latest.metrics_snapshot.cac_cents) / 100).toFixed(2)}`
            : latest.rationale.slice(0, 40)
          }
        </p>
      </div>
    </div>
  )
}
```

---

## Task 41: ActiveExperimentsPanel Component

**File**: [`frontend/components/overview/ActiveExperimentsPanel.tsx`](../../frontend/components/overview/ActiveExperimentsPanel.tsx)

Mini-version of the experiments list for the overview (no editing, just status + metrics):

```tsx
import { useExperimentMetrics } from '@/lib/hooks/useExperimentMetrics'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { Experiment } from '@/lib/types'

export function ActiveExperimentsPanel({ experiments, showId }: { experiments: Experiment[]; showId: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h3 className="font-semibold">Active Experiments</h3>
        <span className="text-xs text-text-muted">{experiments.length} running</span>
      </div>
      {experiments.length === 0 ? (
        <div className="p-5 text-sm text-text-muted">No active experiments.</div>
      ) : (
        <ul className="divide-y divide-border">
          {experiments.map(exp => (
            <ExperimentRow key={exp.experiment_id} experiment={exp} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ExperimentRow({ experiment }: { experiment: Experiment }) {
  const { data: metrics } = useExperimentMetrics(experiment.experiment_id)

  return (
    <li className="p-5 hover:bg-bg/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{experiment.channel} experiment</h4>
            <ChannelBadge channel={experiment.channel} />
          </div>
          <p className="text-xs text-text-muted font-mono">{experiment.experiment_id.slice(0, 12)}</p>
        </div>
        <StatusBadge status={experiment.status} />
      </div>
      {metrics && (
        <div className="flex items-center gap-6 text-xs text-text-muted">
          <span>Budget: <span className="font-medium text-text">${(experiment.budget_cap_cents / 100).toFixed(0)}</span></span>
          <span>Spent: <span className="font-medium text-text">${metrics.total_spend_usd.toFixed(0)}</span></span>
          <span>Clicks: <span className="font-medium text-text">{metrics.total_clicks}</span></span>
          <span>Purchases: <span className="font-medium text-text">{metrics.total_purchases}</span></span>
        </div>
      )}
    </li>
  )
}
```

---

## Task 42: Settings Page

**File**: [`frontend/app/settings/page.tsx`](../../frontend/app/settings/page.tsx)

Simple page for global settings stored in `localStorage`. No backend needed.

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setApiUrl(localStorage.getItem('btp_api_url') ?? 'http://localhost:8000')
  }, [])

  function save() {
    localStorage.setItem('btp_api_url', apiUrl)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold mb-8">Settings</h2>
      <div className="bg-surface border border-border rounded-lg p-6 space-y-5">
        <h3 className="font-semibold">API Configuration</h3>
        <FormField label="Backend API URL">
          <input
            value={apiUrl}
            onChange={e => setApiUrl(e.target.value)}
            className="input w-full"
            placeholder="http://localhost:8000"
          />
          <p className="text-xs text-text-muted mt-1">
            Override the default API URL (useful for remote deployments).
          </p>
        </FormField>
        <div className="flex items-center gap-3">
          <button onClick={save} className="btn-primary text-sm">Save</button>
          {saved && <span className="text-xs text-success">✓ Saved</span>}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 mt-5 space-y-3">
        <h3 className="font-semibold">Default Ticket URL</h3>
        <p className="text-sm text-text-muted">
          Set per-show ticket URLs when creating or editing shows. The ticket URL is used 
          to generate UTM tracking links.
        </p>
      </div>
    </div>
  )
}
```

---

## Task 43: Polish Pass

### 43.1 Error boundaries

**File**: [`frontend/components/shared/ErrorBoundary.tsx`](../../frontend/components/shared/ErrorBoundary.tsx)

```tsx
'use client'
import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 bg-danger-light rounded-lg text-danger" role="alert">
          <p className="font-medium">Something went wrong</p>
          <p className="text-sm mt-1">{this.state.error?.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
```

Wrap each tab section inside `<ErrorBoundary>` so a broken section doesn't crash the whole page.

### 43.2 Skeleton screens for all heavy data sections

Identify all sections with async data and ensure they have a skeleton state:
- `SegmentsSkeleton` — 2 placeholder cards
- `FramesSkeleton` — 2 placeholder cards per segment
- `ExperimentsListSkeleton` — 3 placeholder rows
- `OverviewSkeleton` — header + KPI cards + two-column section

Pattern for all skeletons:
```tsx
export function SegmentsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2].map(i => (
        <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
          <div className="h-5 bg-bg rounded w-2/3 mb-2" />
          <div className="h-4 bg-bg rounded w-1/2 mb-4" />
          <div className="h-2 bg-bg rounded w-full mb-1" />
          <div className="h-2 bg-bg rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}
```

### 43.3 Accessible focus management for modals

shadcn `Dialog` handles focus trapping automatically. Verify:
- When any modal opens, focus moves to the first focusable element inside it
- When modal closes, focus returns to the trigger button

Use `initialFocus` prop on `DialogContent` where needed:
```tsx
<DialogContent initialFocus={nameInputRef}>
```

### 43.4 ARIA labels audit

Check every interactive section and add missing labels:
- All `<section>` elements must have `aria-labelledby` pointing to their heading
- Progress bars need `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Sparklines are decorative — `aria-hidden="true"`
- Status dots are decorative — `aria-hidden="true"`
- The `CycleStepper` needs `aria-label="Cycle progress"` on the `<nav>`, and `aria-current="step"` on the current step

### 43.5 Keyboard navigation: CycleStepper

The stepper's `<li>` elements are links, so they're keyboard-accessible by default. Verify tab order is correct and each step is reachable by keyboard.

### 43.6 Responsive check

The layout uses `flex min-h-screen` with a fixed-width `w-64` sidebar. On tablet (768px–1024px):
- Sidebar may need to collapse or shrink to `w-16` showing icons only
- The two-column grid in overview should stack to single column at `lg:` breakpoint

Minimum working tablet behavior: sidebar stays but main content scrolls. Full mobile-responsive sidebar is out of scope for Phase 3.

### 43.7 Toast notifications

Install and wire a toast system for mutation success/failure feedback:
```bash
# shadcn Sonner integration
npx shadcn@latest add sonner
```

Add `<Toaster />` to root layout. Replace standalone `ErrorBanner` in forms with `toast.error()` for transient errors, keeping `ErrorBanner` only for persistent/blocking errors.

Pattern:
```ts
import { toast } from 'sonner'

mutation = useMutation({
  mutationFn: ...,
  onSuccess: () => toast.success('Segment approved'),
  onError: (e) => toast.error(e.message),
})
```

### 43.8 React Query global error handler

In `providers.tsx`, add a global error handler:
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})
```

---

## Summary: Files Created/Modified in This Plan

### New files
| File | Purpose |
|------|---------|
| `frontend/app/shows/[show_id]/overview/page.tsx` | Show overview page |
| `frontend/app/settings/page.tsx` | Settings page |
| `frontend/components/shared/KPIStat.tsx` | Reusable KPI card |
| `frontend/components/shared/ErrorBoundary.tsx` | Error boundary |
| `frontend/components/overview/NextActionPanel.tsx` | Next-action CTA panel |
| `frontend/components/overview/ActivityFeed.tsx` | Domain events timeline |
| `frontend/components/overview/PastDecisionsPanel.tsx` | Past cycle decisions |
| `frontend/components/overview/ActiveExperimentsPanel.tsx` | Running experiments list |

### Modified files
| File | Change |
|------|--------|
| `frontend/app/providers.tsx` | Add global QueryClient error handler, Sonner Toaster |
| `frontend/tailwind.config.ts` | Add `@tailwindcss/typography` plugin |
| All form components | Replace `ErrorBanner` with `toast.error()` for transient errors |
| All tab pages | Wrap sections in `<ErrorBoundary>` |
| All skeleton-capable sections | Add `isLoading` skeleton states |

---

## Final Deliverable Checklist

Before declaring Phase 3 complete, verify:

- [ ] All 6 show sub-pages load, display data, and handle empty/loading/error states
- [ ] Agent runs (strategy, creative, memo) enqueue jobs and poll to completion
- [ ] Approval (approve/reject) for segments, frames, variants persists to backend
- [ ] Experiments can be created from approved creative, marked launched, and stopped
- [ ] Observations can be entered and the decision engine can be triggered per experiment
- [ ] Memos can be generated and rendered as formatted markdown
- [ ] UTM bundles are generated correctly for all platforms and copy-able
- [ ] CycleStepper updates correctly as the cycle progresses
- [ ] NextActionPanel always shows the correct next step
- [ ] All modals trap focus correctly and return focus on close
- [ ] All sections have visible loading skeletons
- [ ] All error states are handled gracefully with retry options
- [ ] No page crash when backend returns 5xx errors
- [ ] Tablet layout (width ≥ 768px) is functional
