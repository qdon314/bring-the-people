# Phase 3: Frontend Scaffold + Show Shell Implementation Plan

Covers Steps 3–5 from the build order: project scaffold, API client layer, Show shell (layout + stepper), and Shows list/create.

**Parent design**: [`docs/plans/2026-02-23-phase3-dashboard.md`](2026-02-23-phase3-dashboard.md)
**Backend must be complete first**: [`docs/plans/2026-02-23-phase3-backend-impl.md`](2026-02-23-phase3-backend-impl.md)

---

## Task 8: Project Scaffold

### 8.1 Create Next.js app

```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd frontend
```

### 8.2 Install dependencies

```bash
# UI
npx shadcn@latest init
npx shadcn@latest add button badge card input label select textarea dialog sheet tabs skeleton toast

# Data fetching
npm install @tanstack/react-query @tanstack/react-query-devtools

# Forms
npm install react-hook-form zod @hookform/resolvers

# Markdown
npm install react-markdown

# Charts
npm install recharts

# Utilities
npm install date-fns
```

### 8.3 Design tokens

**File**: [`frontend/tailwind.config.ts`](../../frontend/tailwind.config.ts)

Copy the exact design token values from [`docs/designs/dashboard-prototype.html`](../designs/dashboard-prototype.html):

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#faf8f5',
        surface: '#ffffff',
        border: '#e8e4de',
        text: { DEFAULT: '#2d2319', muted: '#78695a' },
        primary: { DEFAULT: '#c05621', hover: '#9c4318', light: '#fef3ec' },
        accent: { DEFAULT: '#2b6cb0', light: '#ebf4ff' },
        success: { DEFAULT: '#2f855a', light: '#f0fff4' },
        warning: { DEFAULT: '#d69e2e', light: '#fefcbf' },
        danger: { DEFAULT: '#c53030', light: '#fff5f5' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
}
export default config
```

Add Google Fonts to [`app/layout.tsx`](../../frontend/app/layout.tsx):
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
```

### 8.4 Global styles

**File**: [`frontend/app/globals.css`](../../frontend/app/globals.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #e8e4de; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #d4cfc8; }

/* Focus ring */
:focus-visible {
  outline: 2px solid #c05621;
  outline-offset: 2px;
  border-radius: 4px;
}
```

### 8.5 Environment config

**File**: [`frontend/.env.local`](../../frontend/.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**File**: [`frontend/.env.example`](../../frontend/.env.example)

Same content. Commit `.env.example`; gitignore `.env.local`.

### 8.6 TypeScript types

**File**: [`frontend/lib/types.ts`](../../frontend/lib/types.ts)

Mirror all backend Pydantic response schemas:

```ts
export interface Show {
  show_id: string
  artist_name: string
  city: string
  venue: string
  show_time: string      // ISO 8601 datetime string
  timezone: string
  capacity: number
  tickets_total: number
  tickets_sold: number
  currency: string
  ticket_base_url: string | null
}

export interface Cycle {
  cycle_id: string
  show_id: string
  started_at: string
  label: string | null
}

export type ReviewStatus = 'draft' | 'approved' | 'rejected'

export interface Segment {
  segment_id: string
  show_id: string
  cycle_id: string | null
  name: string
  definition_json: Record<string, unknown>
  estimated_size: number | null
  created_by: string
  review_status: ReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface Frame {
  frame_id: string
  show_id: string
  segment_id: string
  cycle_id: string | null
  hypothesis: string
  promise: string
  evidence_refs: Record<string, unknown>[]
  channel: string
  risk_notes: string | null
  review_status: ReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface Variant {
  variant_id: string
  frame_id: string
  cycle_id: string | null
  platform: string
  hook: string
  body: string
  cta: string
  constraints_passed: boolean
  review_status: ReviewStatus
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface Experiment {
  experiment_id: string
  show_id: string
  segment_id: string
  frame_id: string
  cycle_id: string | null
  channel: string
  objective: string
  budget_cap_cents: number
  status: ExperimentStatus
  start_time: string | null
  end_time: string | null
  baseline_snapshot: Record<string, unknown>
}

export type ExperimentStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'running'
  | 'completed'
  | 'stopped'
  | 'archived'

export interface Observation {
  observation_id: string
  experiment_id: string
  window_start: string
  window_end: string
  spend_cents: number
  impressions: number
  clicks: number
  sessions: number
  checkouts: number
  purchases: number
  revenue_cents: number
  refunds: number
  refund_cents: number
  complaints: number
  negative_comment_rate: number | null
  attribution_model: string
}

export interface Decision {
  decision_id: string
  experiment_id: string
  action: 'scale' | 'hold' | 'kill'
  confidence: number
  rationale: string
  policy_version: string
  metrics_snapshot: Record<string, unknown>
}

export interface ExperimentMetrics {
  experiment_id: string
  total_spend_cents: number
  total_impressions: number
  total_clicks: number
  total_purchases: number
  total_revenue_cents: number
  windows_count: number
  ctr: number | null
  cpc_cents: number | null
  cpa_cents: number | null
  roas: number | null
  conversion_rate: number | null
  evidence_sufficient: boolean
}

export interface ProducerMemo {
  memo_id: string
  show_id: string
  cycle_id: string | null
  cycle_start: string
  cycle_end: string
  markdown: string
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface BackgroundJob {
  job_id: string
  job_type: string
  status: JobStatus
  show_id: string
  result_json: Record<string, unknown> | null
  error_message: string | null
  attempt_count: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface DomainEvent {
  event_id: string
  at: string
  show_id: string
  cycle_id: string | null
  type: string
  actor: string
  display: { title: string; subtitle: string }
  payload: Record<string, unknown>
}

export interface ApiError {
  status: number
  detail: string
}
```

---

## Task 9: API Client Layer

### 9.1 Base client

**File**: [`frontend/lib/api/client.ts`](../../frontend/lib/api/client.ts)

```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch {}
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const client = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
```

### 9.2 API modules

**File**: [`frontend/lib/api/shows.ts`](../../frontend/lib/api/shows.ts)

```ts
import { client } from './client'
import type { Show } from '../types'

export const showsApi = {
  list: () => client.get<Show[]>('/api/shows'),
  get: (id: string) => client.get<Show>(`/api/shows/${id}`),
  create: (body: Omit<Show, 'show_id'>) => client.post<Show>('/api/shows', body),
  update: (id: string, body: Partial<Show>) => client.patch<Show>(`/api/shows/${id}`, body),
}
```

Similarly create:
- [`frontend/lib/api/cycles.ts`](../../frontend/lib/api/cycles.ts)
- [`frontend/lib/api/segments.ts`](../../frontend/lib/api/segments.ts) — includes `review(id, action)`
- [`frontend/lib/api/frames.ts`](../../frontend/lib/api/frames.ts) — includes `review(id, action)`
- [`frontend/lib/api/variants.ts`](../../frontend/lib/api/variants.ts) — includes `review(id, action)`
- [`frontend/lib/api/experiments.ts`](../../frontend/lib/api/experiments.ts) — includes `submit`, `approve`, `start`, `complete`, `stop`, `metrics`
- [`frontend/lib/api/observations.ts`](../../frontend/lib/api/observations.ts)
- [`frontend/lib/api/decisions.ts`](../../frontend/lib/api/decisions.ts)
- [`frontend/lib/api/strategy.ts`](../../frontend/lib/api/strategy.ts) — returns `{ job_id, status }`
- [`frontend/lib/api/creative.ts`](../../frontend/lib/api/creative.ts) — returns `{ job_id, status }`
- [`frontend/lib/api/memos.ts`](../../frontend/lib/api/memos.ts) — includes `run`, `list`, `get`
- [`frontend/lib/api/jobs.ts`](../../frontend/lib/api/jobs.ts) — `get(job_id)`
- [`frontend/lib/api/events.ts`](../../frontend/lib/api/events.ts)

### 9.3 TanStack Query setup

**File**: [`frontend/app/providers.tsx`](../../frontend/app/providers.tsx)

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }))
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  )
}
```

Wrap root layout in `<Providers>`.

### 9.4 Standard query hooks

**File**: [`frontend/lib/hooks/useShow.ts`](../../frontend/lib/hooks/useShow.ts)

```ts
import { useQuery } from '@tanstack/react-query'
import { showsApi } from '../api/shows'

export function useShow(showId: string) {
  return useQuery({
    queryKey: ['shows', showId],
    queryFn: () => showsApi.get(showId),
    enabled: !!showId,
  })
}

export function useShows() {
  return useQuery({
    queryKey: ['shows'],
    queryFn: showsApi.list,
  })
}
```

Create similarly: `useSegments`, `useFrames`, `useVariants`, `useExperiments`, `useDecisions`, `useMemos`, `useCycles`, `useEvents`.

### 9.5 Job poller hook

**File**: [`frontend/lib/hooks/useJobPoller.ts`](../../frontend/lib/hooks/useJobPoller.ts)

```ts
import { useQuery } from '@tanstack/react-query'
import { jobsApi } from '../api/jobs'
import type { BackgroundJob } from '../types'

function getInterval(elapsed: number): number {
  if (elapsed < 20_000) return 2_000
  if (elapsed < 80_000) return 4_000
  return 8_000
}

export function useJobPoller(jobId: string | null) {
  const startTime = useState(() => Date.now())[0]

  return useQuery<BackgroundJob>({
    queryKey: ['jobs', jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data || data.status === 'queued' || data.status === 'running') {
        return getInterval(Date.now() - startTime)
      }
      return false  // stop polling when completed or failed
    },
    staleTime: 0,
  })
}
```

---

## Task 10: App Shell Layout

### 10.1 Root layout

**File**: [`frontend/app/layout.tsx`](../../frontend/app/layout.tsx)

```tsx
import type { Metadata } from 'next'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bring the People',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg font-sans text-text antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main id="main-content" className="flex-1 flex flex-col min-w-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

### 10.2 Sidebar component

**File**: [`frontend/components/layout/Sidebar.tsx`](../../frontend/components/layout/Sidebar.tsx)

Structure (from prototype):
- Logo/brand header: "Bring the People"
- Nav links: Shows, Experiments (optional), Knowledge Base (disabled/deferred)
- "Recent Shows" section: dynamic — `useShows()`, show 3 most recent with status dot
- Bottom: Settings link

Nav item active state: compare `pathname` from `usePathname()` to route.

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useShows } from '@/lib/hooks/useShow'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()
  const { data: shows } = useShows()
  const recentShows = shows?.slice(0, 3) ?? []

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">Bring the People</h1>
      </div>
      {/* Nav */}
      <nav className="flex-1 p-3" aria-label="Main navigation">
        <ul className="space-y-1">
          <NavItem href="/shows" icon={<GridIcon />} label="Shows" pathname={pathname} />
          <NavItem href="/experiments" icon={<FlaskIcon />} label="Experiments" pathname={pathname} />
        </ul>
        {recentShows.length > 0 && (
          <div className="mt-8 pt-4 border-t border-border">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Recent Shows
            </p>
            <ul className="space-y-1">
              {recentShows.map(show => (
                <li key={show.show_id}>
                  <Link href={`/shows/${show.show_id}/overview`}
                    className={cn('nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                      pathname.includes(show.show_id)
                        ? 'bg-bg text-text font-medium'
                        : 'text-text-muted hover:bg-bg hover:text-text'
                    )}>
                    <StatusDot show={show} />
                    {show.artist_name} – {show.city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      {/* Settings */}
      <div className="p-3 border-t border-border">
        <NavItem href="/settings" icon={<SettingsIcon />} label="Settings" pathname={pathname} />
      </div>
    </aside>
  )
}
```

`StatusDot` logic:
- Past show (show_time < now): grey dot
- Active (any running experiments): green dot
- Otherwise: muted dot

### 10.3 Root page redirect

**File**: [`frontend/app/page.tsx`](../../frontend/app/page.tsx)

```tsx
import { redirect } from 'next/navigation'
export default function Home() { redirect('/shows') }
```

---

## Task 11: Shows List Page

**File**: [`frontend/app/shows/page.tsx`](../../frontend/app/shows/page.tsx)

```tsx
'use client'
import { useShows } from '@/lib/hooks/useShow'
import { ShowCard } from '@/components/shows/ShowCard'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ShowsPage() {
  const { data: shows, isLoading, error } = useShows()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Shows</h2>
          <Button asChild>
            <Link href="/shows/new">+ New Show</Link>
          </Button>
        </div>

        {/* Loading state */}
        {isLoading && <ShowsListSkeleton />}

        {/* Error state */}
        {error && <ErrorBanner message={error.message} />}

        {/* Empty state */}
        {shows?.length === 0 && <ShowsEmptyState />}

        {/* Shows grid */}
        {shows && shows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shows.map(show => <ShowCard key={show.show_id} show={show} />)}
          </div>
        )}
      </div>
    </div>
  )
}
```

**File**: [`frontend/components/shows/ShowCard.tsx`](../../frontend/components/shows/ShowCard.tsx)

```tsx
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { daysUntilShow, getShowPhaseLabel, getShowStatus } from '@/lib/utils/dates'
import type { Show } from '@/lib/types'

export function ShowCard({ show }: { show: Show }) {
  const daysAway = daysUntilShow(show.show_time)
  const status = getShowStatus(show)    // 'past' | 'active' | 'draft'
  const pct = Math.round((show.tickets_sold / show.tickets_total) * 100)

  return (
    <Link href={`/shows/${show.show_id}/overview`}>
      <Card className="p-5 card-hover cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{show.artist_name}</h3>
            <p className="text-sm text-text-muted">{show.venue}, {show.city}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <p className="text-sm mb-3">
          {formatDate(show.show_time)}
          {daysAway > 0 && (
            <span className="ml-2 font-medium text-text">{daysAway} days away</span>
          )}
        </p>

        {/* Capacity bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{show.tickets_sold.toLocaleString()} sold</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-text-muted">{show.capacity.toLocaleString()} capacity</p>
        </div>
      </Card>
    </Link>
  )
}
```

**File**: [`frontend/lib/utils/dates.ts`](../../frontend/lib/utils/dates.ts)

```ts
import { differenceInDays, format } from 'date-fns'

export function daysUntilShow(showTime: string): number {
  return Math.max(0, differenceInDays(new Date(showTime), new Date()))
}

export function getShowPhaseLabel(daysAway: number): string {
  if (daysAway >= 22) return 'Early'
  if (daysAway >= 8) return 'Mid'
  return 'Late'
}

export function getShowStatus(show: Show): 'past' | 'active' | 'draft' {
  if (new Date(show.show_time) < new Date()) return 'past'
  // 'active' check would need experiment data; use 'draft' as default
  return 'draft'
}

export function formatDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy')
}
```

---

## Task 12: Create Show Page

**File**: [`frontend/app/shows/new/page.tsx`](../../frontend/app/shows/new/page.tsx)

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { showsApi } from '@/lib/api/shows'

const schema = z.object({
  artist_name: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  venue: z.string().min(1).max(255),
  show_time: z.string().min(1),
  timezone: z.string().min(1).max(50),
  capacity: z.coerce.number().int().positive(),
  tickets_total: z.coerce.number().int().min(0),
  tickets_sold: z.coerce.number().int().min(0).default(0),
  currency: z.string().length(3).default('USD'),
  ticket_base_url: z.string().url().optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

export default function NewShowPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormData) => showsApi.create(data),
    onSuccess: (show) => {
      qc.invalidateQueries({ queryKey: ['shows'] })
      router.push(`/shows/${show.show_id}/overview`)
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold mb-8">New Show</h2>
      <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        {/* Artist name */}
        <FormField label="Artist name" error={form.formState.errors.artist_name?.message}>
          <input {...form.register('artist_name')} className="input" placeholder="e.g. Khruangbin" />
        </FormField>
        {/* Venue */}
        <FormField label="Venue" error={form.formState.errors.venue?.message}>
          <input {...form.register('venue')} className="input" placeholder="e.g. Thalia Hall" />
        </FormField>
        {/* City */}
        <FormField label="City" error={form.formState.errors.city?.message}>
          <input {...form.register('city')} className="input" placeholder="e.g. Chicago" />
        </FormField>
        {/* Show date/time */}
        <FormField label="Show date & time" error={form.formState.errors.show_time?.message}>
          <input {...form.register('show_time')} type="datetime-local" className="input" />
        </FormField>
        {/* Timezone */}
        <FormField label="Timezone" error={form.formState.errors.timezone?.message}>
          <input {...form.register('timezone')} className="input" placeholder="e.g. America/Chicago" />
        </FormField>
        {/* Capacity */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Capacity" error={form.formState.errors.capacity?.message}>
            <input {...form.register('capacity')} type="number" className="input" />
          </FormField>
          <FormField label="Tickets available" error={form.formState.errors.tickets_total?.message}>
            <input {...form.register('tickets_total')} type="number" className="input" />
          </FormField>
        </div>
        {/* Ticket URL */}
        <FormField label="Ticket URL (for UTMs)" error={undefined}>
          <input {...form.register('ticket_base_url')} className="input" placeholder="https://dice.fm/..." />
        </FormField>

        {mutation.error && <ErrorBanner message={mutation.error.message} />}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Creating…' : 'Create Show'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

---

## Task 13: Show Layout (Header + CycleStepper)

### 13.1 Show layout file

**File**: [`frontend/app/shows/[show_id]/layout.tsx`](../../frontend/app/shows/[show_id]/layout.tsx)

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useShow } from '@/lib/hooks/useShow'
import { useSegments } from '@/lib/hooks/useSegments'
import { useVariants } from '@/lib/hooks/useVariants'
import { useExperiments } from '@/lib/hooks/useExperiments'
import { useObservations } from '@/lib/hooks/useObservations'
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
    create: (frames?.some(f => /* has variants */ false)) ?? false,  // TODO: need variant counts
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
```

### 13.2 ShowHeader component

**File**: [`frontend/components/layout/ShowHeader.tsx`](../../frontend/components/layout/ShowHeader.tsx)

```tsx
import type { Show } from '@/lib/types'
import { daysUntilShow, getShowPhaseLabel, formatDate } from '@/lib/utils/dates'

export function ShowHeader({ show }: { show: Show }) {
  const daysAway = daysUntilShow(show.show_time)
  const phase = getShowPhaseLabel(daysAway)
  const pct = Math.round((show.tickets_sold / show.tickets_total) * 100)

  return (
    <header className="bg-surface border-b border-border px-8 py-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight">{show.artist_name}</h2>
            <span className="badge-success">Active</span>
          </div>
          <p className="text-text-muted text-sm">
            {show.venue}, {show.city} · {formatDate(show.show_time)} ·{' '}
            <span className="font-medium text-text">
              {daysAway > 0 ? `${daysAway} days away` : 'Today'}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-muted mb-1">Ticket Sales</p>
          <p className="text-2xl font-bold">
            {show.tickets_sold.toLocaleString()}{' '}
            <span className="text-base font-normal text-text-muted">
              / {show.tickets_total.toLocaleString()}
            </span>
          </p>
          <div
            className="w-48 h-2 bg-bg rounded-full mt-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of tickets sold`}
          >
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-text-muted mt-1">{pct}% capacity · {phase} phase</p>
        </div>
      </div>
    </header>
  )
}
```

### 13.3 CycleStepper component

**File**: [`frontend/components/layout/CycleStepper.tsx`](../../frontend/components/layout/CycleStepper.tsx)

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckIcon } from '@/components/icons'

const STEPS = [
  { key: 'plan',    label: 'Plan',    path: 'plan' },
  { key: 'create',  label: 'Create',  path: 'create' },
  { key: 'run',     label: 'Run',     path: 'run' },
  { key: 'results', label: 'Results', path: 'results' },
  { key: 'memo',    label: 'Memo',    path: 'memo' },
]

interface StepperState {
  plan: boolean
  create: boolean
  run: boolean
  results: boolean
  memo: boolean
}

interface CycleStepperProps {
  showId: string
  state: StepperState
}

export function CycleStepper({ showId, state }: CycleStepperProps) {
  const pathname = usePathname()

  return (
    <div className="bg-surface border-b border-border px-8 py-3">
      <nav aria-label="Cycle progress">
        <ol className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isCompleted = state[step.key as keyof StepperState]
            const href = `/shows/${showId}/${step.path}`
            const isCurrent = pathname.endsWith(`/${step.path}`)
            const isLast = i === STEPS.length - 1

            return (
              <>
                <li key={step.key}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isCurrent ? 'bg-primary-light' : 'hover:bg-bg'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                      isCompleted
                        ? 'bg-primary text-white'
                        : isCurrent
                          ? 'bg-primary text-white font-bold'
                          : 'bg-bg text-text-muted border border-border'
                    }`}>
                      {isCompleted ? <CheckIcon className="w-4 h-4" /> : i + 1}
                    </span>
                    <span className={`text-sm ${
                      isCurrent ? 'font-semibold text-primary' :
                      isCompleted ? 'font-medium text-text' :
                      'text-text-muted'
                    }`}>
                      {step.label}
                    </span>
                  </Link>
                </li>
                {!isLast && (
                  <li
                    aria-hidden="true"
                    className={`h-0.5 flex-1 min-w-6 ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                  />
                )}
              </>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
```

### 13.4 Show redirect

**File**: [`frontend/app/shows/[show_id]/page.tsx`](../../frontend/app/shows/[show_id]/page.tsx)

```tsx
import { redirect } from 'next/navigation'
export default function ShowRoot({ params }: { params: { show_id: string } }) {
  redirect(`/shows/${params.show_id}/overview`)
}
```

---

## Task 14: Shared Components

### StatusBadge

**File**: [`frontend/components/shared/StatusBadge.tsx`](../../frontend/components/shared/StatusBadge.tsx)

```tsx
type Status = 'draft' | 'approved' | 'rejected' | 'running' | 'completed' | 'stopped'
  | 'scale' | 'hold' | 'kill' | 'active' | 'past' | 'queued' | 'failed'

const STATUS_STYLES: Record<Status, string> = {
  draft:      'bg-bg text-text-muted border border-border',
  approved:   'bg-success-light text-success',
  rejected:   'bg-danger-light text-danger',
  running:    'bg-success-light text-success',
  completed:  'bg-accent-light text-accent',
  stopped:    'bg-bg text-text-muted',
  scale:      'bg-success-light text-success',
  hold:       'bg-warning-light text-warning',
  kill:       'bg-danger-light text-danger',
  active:     'bg-success-light text-success',
  past:       'bg-bg text-text-muted',
  queued:     'bg-warning-light text-warning',
  failed:     'bg-danger-light text-danger',
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
```

### ErrorBanner

**File**: [`frontend/components/shared/ErrorBanner.tsx`](../../frontend/components/shared/ErrorBanner.tsx)

```tsx
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-danger-light border border-danger/20 rounded-lg p-4 flex items-center justify-between" role="alert">
      <div>
        <p className="font-medium text-danger text-sm">Something went wrong</p>
        <p className="text-sm text-text-muted mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-danger underline">
          Retry
        </button>
      )}
    </div>
  )
}
```

### Skeleton components

**File**: [`frontend/components/shared/Skeletons.tsx`](../../frontend/components/shared/Skeletons.tsx)

```tsx
export function ShowsListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1,2,3].map(i => (
        <div key={i} className="bg-surface border border-border rounded-lg p-5 space-y-3 animate-pulse">
          <div className="h-5 bg-bg rounded w-2/3" />
          <div className="h-4 bg-bg rounded w-1/2" />
          <div className="h-2 bg-bg rounded w-full" />
        </div>
      ))}
    </div>
  )
}

export function ShowLayoutSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-surface border-b border-border px-8 py-5 animate-pulse">
        <div className="h-8 bg-bg rounded w-64 mb-2" />
        <div className="h-4 bg-bg rounded w-96" />
      </div>
      <div className="bg-surface border-b border-border px-8 py-3 animate-pulse">
        <div className="h-8 bg-bg rounded w-80" />
      </div>
    </div>
  )
}
```

---

## Utility: `cn()` helper

**File**: [`frontend/lib/utils.ts`](../../frontend/lib/utils.ts)

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Install: `npm install clsx tailwind-merge`

---

## Testing Notes

- No test framework is specified for the frontend yet. Recommend `vitest` + `@testing-library/react` for unit/component tests.
- Key things to test: `useJobPoller` backoff logic, `StatusBadge` rendering for each status value, `CycleStepper` step markers including `aria-current`, `ShowCard` capacity percentage and status derive correctly.
- End-to-end: Playwright against a running dev server with a seeded test database.

---

## Summary: Files Created in This Plan

| File | Purpose |
|------|---------|
| `frontend/tailwind.config.ts` | Design tokens |
| `frontend/app/globals.css` | Base styles |
| `frontend/app/layout.tsx` | Root layout with Sidebar + Providers |
| `frontend/app/providers.tsx` | QueryClientProvider |
| `frontend/app/page.tsx` | Redirect to /shows |
| `frontend/app/shows/page.tsx` | Shows list |
| `frontend/app/shows/new/page.tsx` | Create show form |
| `frontend/app/shows/[show_id]/layout.tsx` | Show shell with header + stepper |
| `frontend/app/shows/[show_id]/page.tsx` | Redirect to overview |
| `frontend/components/layout/Sidebar.tsx` | Left nav |
| `frontend/components/layout/ShowHeader.tsx` | Show title + capacity bar |
| `frontend/components/layout/CycleStepper.tsx` | Step tabs |
| `frontend/components/shows/ShowCard.tsx` | Show card for list |
| `frontend/components/shared/StatusBadge.tsx` | Reusable badge |
| `frontend/components/shared/ErrorBanner.tsx` | Error display |
| `frontend/components/shared/Skeletons.tsx` | Loading placeholders |
| `frontend/lib/types.ts` | All TypeScript types |
| `frontend/lib/utils.ts` | `cn()` helper |
| `frontend/lib/utils/dates.ts` | Date helpers |
| `frontend/lib/api/client.ts` | Base fetch wrapper |
| `frontend/lib/api/shows.ts` + all other api modules | Per-resource API functions |
| `frontend/lib/hooks/useShow.ts` + all other hooks | TanStack Query hooks |
| `frontend/lib/hooks/useJobPoller.ts` | Job polling with backoff |
