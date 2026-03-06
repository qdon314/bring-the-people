# Stage 7 Implementation Plan: Memo Tab UI

**Date:** 2026-03-06  
**Stage:** 7  
**Dependencies:** Stages 0-1 complete (platform, routing, data layers)

---

## Overview

The Memo Tab is the final stage in the workflow. It allows users to:
1. Generate a memo for the current cycle (triggers async job)
2. View memo history for the show
3. Read generated memo content (markdown)

**Backend Contract:**
- `GET /api/memos?show_id={id}` — List memos for show
- `GET /api/memos/{memo_id}` — Get single memo
- `POST /api/memos/{show_id}/run?cycle_start={datetime}&cycle_end={datetime}` — Trigger memo generation job

---

## Task Breakdown

### V2-070: Memo Run Form + Job Polling

**Size:** M  
**Depends on:** -  
**Deliverables:**
- `features/memos/api.ts` — Add `runMemo` function
- `features/memos/mutations.ts` — Add `useRunMemo` mutation
- `features/memos/ui/MemoTriggerPanel.tsx` — Trigger panel with job polling

**Implementation:**

1. **Add `runMemo` to api.ts:**
```typescript
export interface RunMemoResponse {
  job_id: string;
  status: string;
}

export async function runMemo(
  showId: string,
  cycleStart: string,
  cycleEnd: string
): Promise<RunMemoResponse> {
  return apiClient.post('/api/memos/{show_id}/run', {
    path: { show_id: showId },
    query: { cycle_start: cycleStart, cycle_end: cycleEnd },
  }) as Promise<RunMemoResponse>
}
```

2. **Create mutations.ts:**
```typescript
export function useRunMemo(showId: string) {
  return useMutation({
    mutationFn: ({ cycleStart, cycleEnd }: { cycleStart: string; cycleEnd: string }) =>
      runMemo(showId, cycleStart, cycleEnd),
  })
}
```

3. **Create MemoTriggerPanel.tsx:**
   - Follow `StrategyRunPanel.tsx` pattern
   - Accept `cycleStart` and `cycleEnd` props (from cycle data)
   - Use `useJobPolling` hook
   - On complete: invalidate `memoKeys.list(showId)`

**Acceptance Criteria:**

- [ ] **Happy path:** User clicks "Generate Memo" button, button shows spinner during job, toast shows "Memo generated" on success, memo list updates
- [ ] **Loading state:** Button disabled with spinner icon while mutation or polling is active
- [ ] **Error state:** If mutation fails, show ErrorBanner with "Failed to start memo generation" + retry button
- [ ] **Polling error:** If job fails during polling, show error toast "Memo generation failed. Try again."
- [ ] **Edge cases:** Button disabled if cycle dates not available (show loading until cycle data loads)
- [ ] **Tests:** Unit test for mutation, integration test for panel with mocked job polling

---

### V2-071: Memo History List

**Size:** M  
**Depends on:** V2-070 (can start after API/mutations ready)  
**Deliverables:**
- `features/memos/ui/MemoHistoryList.tsx` — List of memos with selection state
- URL query param integration: `?memo={memo_id}`
- Empty state component

**Implementation:**

1. **Update `features/memos/queries.ts`:**
   - Add `useMemo(showId, memoId)` query for fetching single memo
   - Add `getMemo` function to api.ts

2. **Create MemoHistoryList.tsx:**
   - Use `useMemos(showId)` to fetch list
   - Render each memo as a card showing: date range, cycle_id (if present), created timestamp
   - Click to select (update URL query param)
   - Selected memo gets highlighted/active state
   - Sort by date descending (newest first)

3. **URL Behavior:**
   - Read `memo` query param from URL on mount
   - When memo selected, push to URL: `?memo={memoId}`
   - Use `useSearchParams` from next/navigation

4. **Empty State:**
   - If no memos exist, show "No memos yet. Generate your first memo above."

**Acceptance Criteria:**

- [ ] **Happy path:** Memo list renders with date range and cycle info, clicking selects memo and updates URL
- [ ] **Loading state:** Show skeleton loader while `useMemos` is loading
- [ ] **Empty state:** Show "No memos yet" message with call-to-action
- [ ] **Error state:** Show ErrorBanner on fetch failure with retry button
- [ ] **URL sync:** Selecting memo updates URL, page refresh retains selection
- [ ] **Edge cases:** Long memo list should be scrollable; invalid memo ID in URL should be ignored
- [ ] **Tests:** Unit test for MemoHistoryList rendering, test URL sync behavior

---

### V2-072: Memo Markdown Viewer

**Size:** S  
**Depends on:** V2-071 (needs memo selection state)  
**Deliverables:**
- `features/memos/ui/MemoView.tsx` — Renders memo markdown
- `features/memos/ui/MemoViewer.tsx` — Container with selected memo or placeholder

**Implementation:**

1. **Create MemoView.tsx:**
   - Accept `memo: MemoResponse` prop
   - Render `memo.markdown` in a container
   - Use a markdown renderer (check existing usage in codebase or use `react-markdown`)
   - Add appropriate typography styles

2. **Create MemoViewer.tsx (container):**
   - If no memo selected: show placeholder "Select a memo to view"
   - If memo selected but still loading: show skeleton
   - If loaded: render MemoView

**Acceptance Criteria:**

- [ ] **Happy path:** Selected memo markdown renders correctly with proper formatting
- [ ] **Loading state:** Skeleton while fetching single memo
- [ ] **Empty/selection state:** Placeholder text when no memo selected
- [ ] **Error state:** ErrorBanner if memo fetch fails
- [ ] **Edge cases:** Empty markdown field should show "No content"
- [ ] **Tests:** Test markdown rendering with sample content

---

### V2-073: Memo Tab Test Coverage

**Size:** S  
**Depends on:** V2-070, V2-071, V2-072  
**Deliverables:**
- `features/memos/ui/MemoTriggerPanel.test.tsx`
- `features/memos/ui/MemoHistoryList.test.tsx`
- `features/memos/ui/MemoView.test.tsx`
- Integration test: memo generation flow

**Test Coverage Requirements:**

1. **Unit tests:**
   - `MemoTriggerPanel`: Button states, job polling callbacks, error handling
   - `MemoHistoryList`: Rendering, selection, URL sync
   - `MemoView`: Markdown rendering

2. **Integration test (Playwright):**
   - Navigate to memo tab
   - Click "Generate Memo"
   - Wait for job completion
   - Verify memo appears in list
   - Select memo and verify content renders

**Acceptance Criteria:**

- [ ] All memo UI components have passing unit tests (>80% coverage)
- [ ] End-to-end memo generation flow passes in Playwright
- [ ] No console errors in any test

---

## Integration: Memo Tab Page

Update `app/shows/[show_id]/cycles/[cycle_id]/memo/page.tsx`:

```typescript
'use client'

import { useMemo } from 'react'
import { MemoTriggerPanel } from '@/features/memos/ui/MemoTriggerPanel'
import { MemoHistoryList } from '@/features/memos/ui/MemoHistoryList'
import { MemoViewer } from '@/features/memos/ui/MemoViewer'
import { useCycle } from '@/features/cycles/queries'

interface MemoPageProps {
  params: { show_id: string; cycle_id: string }
  searchParams: { memo?: string }
}

export default function MemoPage({ params, searchParams }: MemoPageProps) {
  const { show_id: showId, cycle_id: cycleId } = params
  const selectedMemoId = searchParams.memo
  
  const { data: cycle, isLoading: cycleLoading } = useCycle(showId, cycleId)

  if (cycleLoading) return <MemoPageSkeleton />

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-6">
        <MemoTriggerPanel 
          showId={showId} 
          cycleStart={cycle?.start_date} 
          cycleEnd={cycle?.end_date} 
        />
      </div>
      
      <div className="col-span-4">
        <MemoHistoryList showId={showId} selectedMemoId={selectedMemoId} />
      </div>
      
      <div className="col-span-8">
        <MemoViewer showId={showId} memoId={selectedMemoId} />
      </div>
    </div>
  )
}
```

---

## File Structure Summary

```
frontend-v2/features/memos/
├── api.ts                    # [UPDATE] Add runMemo, getMemo
├── mutations.ts              # [NEW] useRunMemo
├── queries.ts                # [UPDATE] Add useMemo
├── queries.test.ts           # [UPDATE] Add tests for useMemo
└── ui/
    ├── MemoTriggerPanel.tsx  # [NEW]
    ├── MemoTriggerPanel.test.tsx  # [NEW]
    ├── MemoHistoryList.tsx   # [NEW]
    ├── MemoHistoryList.test.tsx   # [NEW]
    ├── MemoView.tsx          # [NEW]
    ├── MemoView.test.tsx     # [NEW]
    ├── MemoViewer.tsx        # [NEW]
    └── MemoViewer.test.tsx   # [NEW]

frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/
└── memo/
    └── page.tsx              # [UPDATE] Wire up components
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cycle dates not available in expected format | Low | Medium | Add type guard, show loading until cycle loads |
| Job polling timeout | Low | Low | useJobPolling has configurable timeout |
| Markdown rendering XSS | Low | High | Sanitize markdown before rendering |
| URL param validation | Medium | Low | Ignore invalid memo IDs gracefully |

---

## Rollback Plan

If issues arise:
1. Revert to placeholder memo page
2. Feature flags not needed (Stage 7 is independent)
3. No database migrations required

---

## Notes

- Use `react-markdown` or check existing markdown usage in codebase
- Follow same patterns as `StrategyRunPanel` for job polling
- Memo selection should not cause full page re-render (use client-side state + URL sync)
- Ensure `cycle_start` and `cycle_end` are passed as ISO strings to API
