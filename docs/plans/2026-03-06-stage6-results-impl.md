# Stage 6 Results — Implementation Plan

**Created:** 2026-03-06  
**Worktree:** stage6-results  
**Workflow Stage:** Results (Plan → Create → Run → **Results** → Memo)

## Overview

The Results tab is Stage 6 of the experiment workflow. It allows producers to:
1. Enter observation data (metrics) for each experiment run
2. View computed performance metrics (CTR, CPC, CPA, ROAS)
3. Rank experiments by different metrics
4. Identify statistically flimsy results
5. Trigger the Decision Engine to get AI recommendations
6. Override decisions manually

## Current State

### Backend (Complete)
- `POST /api/observations` — create single observation
- `POST /api/observations/bulk` — create multiple observations
- `GET /api/observations?run_id=` — list observations for a run
- `POST /api/decisions/evaluate/{run_id}` — trigger decision engine
- `GET /api/decisions?run_id=` — list decisions for a run
- `GET /api/runs?cycle_id=` — list runs for a cycle

### Frontend-v2 (Partial)
- `features/observations/api.ts` — only `listObservations` exists
- `features/observations/queries.ts` — only `useObservations` query exists
- `features/decisions/api.ts` — only `listDecisions` exists
- `features/decisions/queries.ts` — only `useDecisions` query exists
- `features/runs/api.ts` — `listRunsByCycle` exists
- Results page at `app/shows/[show_id]/cycles/[cycle_id]/results/page.tsx` — placeholder only

---

## Task 1: Expand Observations Feature API

**Goal:** Add create and bulk-create API functions to the observations feature.

### Files to Modify
- `frontend-v2/features/observations/api.ts`

### Changes
```typescript
// Add these exports and functions:
export type ObservationCreate = components['schemas']['ObservationCreate']

export async function createObservation(body: ObservationCreate): Promise<ObservationResponse> {
  return apiClient.post('/api/observations', { body }) as Promise<ObservationResponse>
}

export async function createObservationsBulk(body: { observations: ObservationCreate[] }): Promise<ObservationResponse[]> {
  return apiClient.post('/api/observations/bulk', { body }) as Promise<ObservationResponse[]>
}
```

### Acceptance Criteria
- [ ] `createObservation` function exists and calls `POST /api/observations`
- [ ] `createObservationsBulk` function exists and calls `POST /api/observations/bulk`
- [ ] Types are properly imported from generated schema

---

## Task 2: Add Observation Mutation

**Goal:** Add React Query mutation for creating observations.

### Files to Modify
- `frontend-v2/features/observations/queries.ts`

### Changes
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { createObservation, createObservationsBulk, listObservations } from './api'

export function useObservations(runId: string) {
  return useQuery({
    queryKey: queryKeys.observations.list(runId),
    queryFn: () => listObservations(runId),
    enabled: !!runId,
  })
}

export function useCreateObservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createObservation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.observations.list(variables.run_id) })
    },
  })
}

export function useCreateObservationsBulk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createObservationsBulk,
    onSuccess: () => {
      // Invalidate all observation queries since we don't know which runs were affected
      queryClient.invalidateQueries({ queryKey: ['observations'] })
    },
  })
}
```

### Acceptance Criteria
- [ ] `useCreateObservation` mutation exists and calls `createObservation`
- [ ] `useCreateObservationsBulk` mutation exists and calls `createObservationsBulk`
- [ ] Cache is properly invalidated on success

---

## Task 3: Add Computed Metrics Utilities

**Goal:** Create utility functions for computing derived metrics from observations.

### Files to Create
- `frontend-v2/features/observations/utils.ts`

### Implementation
```typescript
import type { ObservationResponse } from './api'

export interface ComputedMetrics {
  ctr: number | null      // click-through rate: clicks / impressions
  cpc: number | null      // cost per click: spend_cents / clicks
  cpa: number | null      // cost per acquisition: spend_cents / purchases
  roas: number | null     // return on ad spend: revenue_cents / spend_cents
}

export function computeMetrics(observation: ObservationResponse): ComputedMetrics {
  const { impressions, clicks, spend_cents, purchases, revenue_cents } = observation
  
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null
  const cpc = clicks > 0 ? spend_cents / clicks : null
  const cpa = purchases > 0 ? spend_cents / purchases : null
  const roas = spend_cents > 0 ? revenue_cents / spend_cents : null
  
  return { ctr, cpc, cpa, roas }
}

export function computeAggregatedMetrics(observations: ObservationResponse[]): ComputedMetrics & { totalSpend: number; totalImpressions: number; totalClicks: number; totalPurchases: number; totalRevenue: number } {
  const totals = observations.reduce(
    (acc, obs) => ({
      spend: acc.spend + obs.spend_cents,
      impressions: acc.impressions + obs.impressions,
      clicks: acc.clicks + obs.clicks,
      purchases: acc.purchases + obs.purchases,
      revenue: acc.revenue + obs.revenue_cents,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 }
  )
  
  const { spend, impressions, clicks, purchases, revenue } = totals
  
  return {
    totalSpend: spend,
    totalImpressions: impressions,
    totalClicks: clicks,
    totalPurchases: purchases,
    totalRevenue: revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpa: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 ? revenue / spend : null,
  }
}

export interface StatisticalFlags {
  lowClicks: boolean
  shortDuration: boolean
  lowSpend: boolean
}

export function getStatisticalFlags(observation: ObservationResponse): StatisticalFlags {
  const MIN_CLICKS = 50
  const MIN_DURATION_DAYS = 3
  const MIN_SPEND_DOLLARS = 50
  
  const durationMs = new Date(observation.window_end).getTime() - new Date(observation.window_start).getTime()
  const durationDays = durationMs / (1000 * 60 * 60 * 24)
  const spendDollars = observation.spend_cents / 100
  
  return {
    lowClicks: observation.clicks < MIN_CLICKS,
    shortDuration: durationDays < MIN_DURATION_DAYS,
    lowSpend: spendDollars < MIN_SPEND_DOLLARS,
  }
}
```

### Acceptance Criteria
- [ ] `computeMetrics` returns CTR, CPC, CPA, ROAS for a single observation
- [ ] `computeAggregatedMetrics` returns totals + computed metrics for multiple observations
- [ ] `getStatisticalFlags` identifies low clicks, short duration, low spend
- [ ] Edge cases handled: division by zero returns null

---

## Task 4: Expand Decisions Feature API

**Goal:** Add the evaluate/run endpoint to trigger the decision engine.

### Files to Modify
- `frontend-v2/features/decisions/api.ts`

### Changes
```typescript
export async function evaluateRun(runId: string): Promise<DecisionResponse> {
  return apiClient.post('/api/decisions/evaluate/{run_id}', {
    path: { run_id: runId },
  }) as Promise<DecisionResponse>
}
```

### Acceptance Criteria
- [ ] `evaluateRun` function exists and calls `POST /api/decisions/evaluate/{run_id}`

---

## Task 5: Add Decision Mutation

**Goal:** Add React Query mutation for triggering the decision engine.

### Files to Modify
- `frontend-v2/features/decisions/queries.ts`

### Changes
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/queryKeys'
import { evaluateRun, listDecisions } from './api'

export function useDecisions(runId: string) {
  return useQuery({
    queryKey: queryKeys.decisions.list(runId),
    queryFn: () => listDecisions(runId),
    enabled: !!runId,
  })
}

export function useEvaluateRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: evaluateRun,
    onSuccess: (_, runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.decisions.list(runId) })
    },
  })
}
```

### Acceptance Criteria
- [ ] `useEvaluateRun` mutation exists and calls `evaluateRun`
- [ ] Cache is properly invalidated on success

---

## Task 6: Implement Run Selector Component

**Goal:** UI to select which run to view results for within the cycle.

### Files to Create
- `frontend-v2/features/results/ui/RunSelector.tsx`

### Implementation
Per the dashboard design spec, the run selector should allow picking an active/decided run in the cycle.

```typescript
'use client'

import { useRuns } from '@/features/runs/queries'
import { useMemo } from 'react'

interface RunSelectorProps {
  cycleId: string
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
}

export function RunSelector({ cycleId, selectedRunId, onSelectRun }: RunSelectorProps) {
  const { data: runs, isLoading, error } = useRuns(cycleId)
  
  const launchableRuns = useMemo(() => {
    if (!runs) return []
    return runs.filter(r => r.status === 'launched' || r.status === 'completed')
  }, [runs])
  
  if (isLoading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded" />
  }
  
  if (error) {
    return <div className="text-red-500 text-sm">Failed to load runs</div>
  }
  
  if (launchableRuns.length === 0) {
    return <div className="text-gray-500 text-sm">No launched runs in this cycle</div>
  }
  
  return (
    <select
      value={selectedRunId || ''}
      onChange={(e) => onSelectRun(e.target.value)}
      className="border rounded px-3 py-2"
    >
      <option value="">Select a run to view results</option>
      {launchableRuns.map(run => (
        <option key={run.run_id} value={run.run_id}>
          {run.experiment_name || run.run_id} — {run.status}
        </option>
      ))}
    </select>
  )
}
```

### Acceptance Criteria
- [ ] Shows loading skeleton while runs are loading
- [ ] Shows error message if runs fail to load
- [ ] Shows empty message if no launched/completed runs exist
- [ ] Lists only runs with status launched or completed
- [ ] Selected run ID is passed to onSelectRun callback

---

## Task 7: Implement Observation Entry Form

**Goal:** Form to enter observation data for a run.

### Files to Create
- `frontend-v2/features/results/ui/ObservationForm.tsx`

### Implementation
Per the dashboard design spec, the form should include:
- Spend
- Impressions
- Clicks
- Purchases (tickets)
- Revenue (optional)
- Notes (qualitative)

```typescript
'use client'

import { useState } from 'react'
import { useCreateObservation } from '@/features/observations/queries'
import type { ObservationCreate } from '@/features/observations/api'

interface ObservationFormProps {
  runId: string
  onSuccess?: () => void
}

export function ObservationForm({ runId, onSuccess }: ObservationFormProps) {
  const createObservation = useCreateObservation()
  const [formData, setFormData] = useState({
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    revenue_cents: 0,
    notes: '',
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const observation: ObservationCreate = {
      run_id: runId,
      window_start: yesterday.toISOString(),
      window_end: now.toISOString(),
      spend_cents: formData.spend_cents,
      impressions: formData.impressions,
      clicks: formData.clicks,
      sessions: 0,
      checkouts: 0,
      purchases: formData.purchases,
      revenue_cents: formData.revenue_cents,
      refunds: 0,
      refund_cents: 0,
      complaints: 0,
      attribution_model: 'last_click_utm',
    }
    
    try {
      await createObservation.mutateAsync(observation)
      onSuccess?.()
      // Reset form
      setFormData({ spend_cents: 0, impressions: 0, clicks: 0, purchases: 0, revenue_cents: 0, notes: '' })
    } catch (error) {
      console.error('Failed to create observation:', error)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Spend (cents)</label>
          <input
            type="number"
            min="0"
            value={formData.spend_cents}
            onChange={(e) => setFormData({ ...formData, spend_cents: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Revenue (cents)</label>
          <input
            type="number"
            min="0"
            value={formData.revenue_cents}
            onChange={(e) => setFormData({ ...formData, revenue_cents: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Impressions</label>
          <input
            type="number"
            min="0"
            value={formData.impressions}
            onChange={(e) => setFormData({ ...formData, impressions: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Clicks</label>
          <input
            type="number"
            min="0"
            value={formData.clicks}
            onChange={(e) => setFormData({ ...formData, clicks: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Purchases</label>
          <input
            type="number"
            min="0"
            value={formData.purchases}
            onChange={(e) => setFormData({ ...formData, purchases: parseInt(e.target.value) || 0 })}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>
      
      <button
        type="submit"
        disabled={createObservation.isPending}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {createObservation.isPending ? 'Saving...' : 'Add Observation'}
      </button>
      
      {createObservation.isError && (
        <p className="text-red-500 text-sm">Failed to save observation</p>
      )}
    </form>
  )
}
```

### Acceptance Criteria
- [ ] Form displays fields for spend, impressions, clicks, purchases, revenue
- [ ] Submit button shows loading state while mutation is pending
- [ ] Success: form resets and parent is notified
- [ ] Error state: error message displayed below form
- [ ] All numeric fields have proper validation (min=0)

---

## Task 8: Implement Results Overview Component

**Goal:** Display observations with computed metrics and statistical flags.

### Files to Create
- `frontend-v2/features/results/ui/ResultsOverview.tsx`

### Implementation
Per the dashboard design spec:
- Show observations with computed CTR, CPC, CPA, ROAS
- Rank by different metrics
- Highlight statistically flimsy flags

```typescript
'use client'

import { useObservations } from '@/features/observations/queries'
import { computeMetrics, computeAggregatedMetrics, getStatisticalFlags } from '@/features/observations/utils'
import Link from 'next/link'

interface ResultsOverviewProps {
  runId: string
  onRunDecision: () => void
  isEvaluating: boolean
}

export function ResultsOverview({ runId, onRunDecision, isEvaluating }: ResultsOverviewProps) {
  const { data: observations, isLoading, error } = useObservations(runId)
  
  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-200 rounded" />
  }
  
  if (error) {
    return <div className="text-red-500">Failed to load observations</div>
  }
  
  if (!observations || observations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No observations yet. Add observation data above.
      </div>
    )
  }
  
  const aggregated = computeAggregatedMetrics(observations)
  
  return (
    <div className="space-y-6">
      {/* Aggregated Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Spend" value={`$${(aggregated.totalSpend / 100).toFixed(2)}`} />
        <MetricCard label="Total Clicks" value={aggregated.totalClicks.toLocaleString()} />
        <MetricCard label="CTR" value={aggregated.ctr ? `${aggregated.ctr.toFixed(2)}%` : '—'} />
        <MetricCard label="CPA" value={aggregated.cpa ? `$${(aggregated.cpa / 100).toFixed(2)}` : '—'} />
        <MetricCard label="ROAS" value={aggregated.roas ? `${aggregated.roas.toFixed(2)}x` : '—'} />
        <MetricCard label="Purchases" value={aggregated.totalPurchases.toLocaleString()} />
        <MetricCard label="Revenue" value={`$${(aggregated.totalRevenue / 100).toFixed(2)}`} />
      </div>
      
      {/* Observations List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Observations</h3>
        {observations.map((obs) => {
          const metrics = computeMetrics(obs)
          const flags = getStatisticalFlags(obs)
          
          return (
            <div key={obs.observation_id} className="border rounded p-4">
              <div className="flex justify-between items-start">
                <div className="text-sm text-gray-500">
                  {new Date(obs.window_start).toLocaleDateString()} — {new Date(obs.window_end).toLocaleDateString()}
                </div>
                {flags.lowClicks && <span className="text-amber-600 text-xs">⚠️ Low clicks</span>}
                {flags.shortDuration && <span className="text-amber-600 text-xs">⚠️ Short duration</span>}
                {flags.lowSpend && <span className="text-amber-600 text-xs">⚠️ Low spend</span>}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                <div>
                  <div className="text-xs text-gray-500">Spend</div>
                  <div>${(obs.spend_cents / 100).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Impressions</div>
                  <div>{obs.impressions.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Clicks</div>
                  <div>{obs.clicks.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Purchases</div>
                  <div>{obs.purchases}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">CTR</div>
                  <div>{metrics.ctr ? `${metrics.ctr.toFixed(2)}%` : '—'}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Decision Actions */}
      <div className="flex gap-4">
        <button
          onClick={onRunDecision}
          disabled={isEvaluating}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isEvaluating ? 'Running Decision Engine...' : 'Run Decision Engine'}
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}
```

### Acceptance Criteria
- [ ] Loading state shown while observations are fetching
- [ ] Error state shown if observations fail to load
- [ ] Empty state shown if no observations exist
- [ ] Aggregated metrics displayed (spend, clicks, CTR, CPA, ROAS, purchases, revenue)
- [ ] Each observation displayed with computed metrics
- [ ] Statistical flags shown (low clicks, short duration, low spend)
- [ ] "Run Decision Engine" button present and shows loading state

---

## Task 9: Implement Manual Decision Override

**Goal:** Allow manual override of decisions (Scale/Hold/Kill with reason).

### Files to Create
- `frontend-v2/features/results/ui/DecisionOverride.tsx`

### Implementation
```typescript
'use client'

import { useState } from 'react'
import { useDecisions } from '@/features/decisions/queries'

interface DecisionOverrideProps {
  runId: string
}

export function DecisionOverride({ runId }: DecisionOverrideProps) {
  const { data: decisions } = useDecisions(runId)
  const [showForm, setShowForm] = useState(false)
  
  const existingDecision = decisions?.[0]
  
  return (
    <div className="border rounded p-4">
      <h3 className="text-lg font-medium mb-4">Decision</h3>
      
      {existingDecision ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              existingDecision.decision === 'scale' ? 'bg-green-100 text-green-800' :
              existingDecision.decision === 'hold' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {existingDecision.decision.toUpperCase()}
            </span>
            <span className="text-sm text-gray-500">
              {existingDecision.source === 'agent' ? 'AI Recommendation' : 'Manual Override'}
            </span>
          </div>
          {existingDecision.reason && (
            <p className="text-sm text-gray-600">{existingDecision.reason}</p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No decision yet. Run the Decision Engine or set manually.</p>
      )}
      
      <button
        onClick={() => setShowForm(!showForm)}
        className="mt-4 text-blue-600 text-sm hover:underline"
      >
        {showForm ? 'Cancel' : 'Set Manual Override'}
      </button>
      
      {showForm && (
        <ManualOverrideForm runId={runId} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

function ManualOverrideForm({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [decision, setDecision] = useState<'scale' | 'hold' | 'kill'>('hold')
  const [reason, setReason] = useState('')
  
  // Note: This would need a useCreateDecision mutation - see Task 10
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Submit decision
    onClose()
  }
  
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Decision</label>
        <div className="flex gap-2">
          {(['scale', 'hold', 'kill'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecision(d)}
              className={`px-3 py-1 rounded text-sm ${
                decision === d
                  ? d === 'scale' ? 'bg-green-600 text-white' :
                    d === 'hold' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          rows={3}
          placeholder="Why are you making this decision?"
        />
      </div>
      
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Save Decision
      </button>
    </form>
  )
}
```

### Acceptance Criteria
- [ ] Shows existing decision if one exists
- [ ] Shows decision source (agent vs manual)
- [ ] Button to set manual override
- [ ] Form with decision options (Scale/Hold/Kill) and reason field
- [ ] Happy path: decision saved and displayed

---

## Task 10: Create Results Feature Shell

**Goal:** Wire up all components into the results page.

### Files to Create/Modify
- Create: `frontend-v2/features/results/api.ts`
- Create: `frontend-v2/features/results/queries.ts`
- Create: `frontend-v2/features/results/ui/index.ts` (export all UI components)
- Modify: `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/results/page.tsx`

### Results Page Implementation
```typescript
'use client'

import { useState } from 'react'
import { RunSelector } from '@/features/results/ui/RunSelector'
import { ObservationForm } from '@/features/results/ui/ObservationForm'
import { ResultsOverview } from '@/features/results/ui/ResultsOverview'
import { DecisionOverride } from '@/features/results/ui/DecisionOverride'
import { useEvaluateRun } from '@/features/decisions/queries'
import { useRuns } from '@/features/runs/queries'

export default function ResultsPage({ params }: { params: { show_id: string; cycle_id: string } }) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const evaluateRun = useEvaluateRun()
  
  // Auto-select first launched run if none selected
  const { data: runs } = useRuns(params.cycle_id)
  
  // ... (logic to auto-select first run)
  
  const handleRunDecision = async () => {
    if (!selectedRunId) return
    await evaluateRun.mutateAsync(selectedRunId)
  }
  
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Results</h1>
      <p className="mt-2 text-sm text-gray-500">Cycle {params.cycle_id} — Stage 6</p>
      
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Select Run</label>
        <RunSelector
          cycleId={params.cycle_id}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
        />
      </div>
      
      {selectedRunId && (
        <>
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-medium mb-4">Add Observation</h2>
              <ObservationForm runId={selectedRunId} />
            </div>
            
            <div>
              <DecisionOverride runId={selectedRunId} />
            </div>
          </div>
          
          <div className="mt-8">
            <ResultsOverview
              runId={selectedRunId}
              onRunDecision={handleRunDecision}
              isEvaluating={evaluateRun.isPending}
            />
          </div>
        </>
      )}
    </main>
  )
}
```

### Acceptance Criteria
- [ ] Run selector displayed at top of page
- [ ] Observation form shown when run is selected
- [ ] Results overview shown when run is selected
- [ ] Decision override shown when run is selected
- [ ] "Run Decision Engine" triggers evaluate endpoint

---

## Task 11: Add Tests

### Tests to Create
- `frontend-v2/features/observations/utils.test.ts`
- `frontend-v2/features/results/ui/RunSelector.test.tsx`
- `frontend-v2/features/results/ui/ObservationForm.test.tsx`
- `frontend-v2/features/results/ui/ResultsOverview.test.tsx`

### Test Coverage Required
- `computeMetrics` — all four metrics calculated correctly, edge cases (division by zero)
- `computeAggregatedMetrics` — sums correctly
- `getStatisticalFlags` — flags triggered at correct thresholds

### Acceptance Criteria
- [ ] Unit tests for all utility functions
- [ ] Component tests verify loading, empty, and error states

---

## Dependencies

```
Task 1 → Task 2 → Task 3 → Task 5 → Task 8
Task 4 → Task 5
Task 1, 2, 3, 4, 5, 6, 7, 8 → Task 9 → Task 10
Task 10 → Task 11
```

---

## Notes

- The observation form currently uses a simple date range (yesterday to now). Future enhancement: allow custom date range.
- Decision override requires backend endpoint for manual decision creation. Check if `POST /api/decisions` exists or needs to be created.
- Run auto-selection logic needs to pick the first launched run on mount.
