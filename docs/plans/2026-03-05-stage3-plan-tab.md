# Stage 3: Plan Tab UI — Implementation Plan

Date: 2026-03-05
Roadmap reference: `docs/plans/2026-03-05-frontend-v2-roadmap.md` (V2-030..V2-037)

---

## Overview

Stage 3 builds the Plan tab UI. It covers:

1. A strategy run panel (triggers the strategy agent, shown only when no segments exist)
2. Segment and frame review lists with approve/reject actions
3. Inline edit modals for segments and frames
4. Review undo (back to pending)
5. Experiment definition creation form (composes a reusable `Experiment` from approved segment + frame)

All backend routes for segments, frames, and experiment creation already exist.
**One backend gap exists:** review undo requires a backend extension (see pre-step below).

---

## Backend Pre-Step (required before V2-035)

**Problem:** `POST /api/segments/{id}/review` and `POST /api/frames/{id}/review` only accept
`action: "approve"` or `action: "reject"`. There is no route or schema path to reset
`review_status` back to `"pending"`.

**Approach:** Add `"undo"` to the `ReviewAction` enum. The review route handles
`action == "undo"` by setting `review_status = pending` and clearing `reviewed_at`
and `reviewed_by`.

**Files to change:**

| File | Change |
|---|---|
| `src/growth/app/schemas.py` | Add `UNDO = "undo"` to `ReviewAction` enum |
| `src/growth/app/api/segments.py` | Handle `ReviewAction.UNDO` → `ReviewStatus.PENDING`, `reviewed_at=None`, `reviewed_by=None` |
| `src/growth/app/api/frames.py` | Same as segments |
| `tests/` | Add test cases for undo action on segments and frames |

**V2-035 is blocked until this ships.**

---

## Conventions reminder

- Routes: `/shows/[show_id]/cycles/[cycle_id]/plan`
- Status values: `pending | approved | rejected` (§1 canonical-values)
- Review action values: `approve | reject | undo` (after backend pre-step)
- Mutations own invalidation — components never touch `queryClient` directly
- Optimistic updates for approve/reject; rollback on error
- All components: four required states (loading skeleton, empty, error banner, success)
- Forms: React Hook Form + Zod; validate on blur; submit button shows gerund while pending
- Modals: Radix Dialog via `shared/ui/dialog.tsx`; close resets form; reject requires confirmation

---

## Shared UI Primitives (created in V2-031)

These are currently `planned` in `frontend-manifest.md`. V2-031 creates all of them.

| Component | Path | Purpose |
|---|---|---|
| `StatusBadge` | `shared/ui/StatusBadge.tsx` | Render review/job/experiment status as coloured badge |
| `ErrorBanner` | `shared/ui/ErrorBanner.tsx` | Query/mutation error display with retry action |
| `EmptyState` | `shared/ui/EmptyState.tsx` | Descriptive empty state with optional CTA |
| `SpinnerIcon` | `shared/ui/SpinnerIcon.tsx` | Inline loading indicator for buttons and polling |
| `Dialog` | `shared/ui/dialog.tsx` | Radix Dialog wrapper (focus trap, Escape/overlay close) |

All downstream tickets (V2-032 through V2-037) may import these freely.
`frontend-manifest.md` must be updated (planned → exists) as part of V2-031.

---

## Work Items

### V2-030 — Strategy run action (`M`)

**Task:** Plan page action that triggers the strategy agent. The panel only renders when
`useSegments` returns an empty list for the current cycle.

**Files:**
- `features/strategy/api.ts` — `runStrategy(showId): Promise<{job_id: string, status: string}>`
- `features/strategy/mutations.ts` — `useRunStrategy(showId)` mutation
- `features/strategy/ui/StrategyRunPanel.tsx` — client component
- `app/shows/[show_id]/cycles/[cycle_id]/plan/page.tsx` — render `<StrategyRunPanel>` when no segments

**Acceptance criteria:**
- [ ] **Happy path:** "Run Strategy" button in `StrategyRunPanel`. On click: `POST /api/strategy/{show_id}/run` fires, returns `job_id`. `useJobPolling(jobId)` begins. On `completed`: toast "Strategy complete", `segmentKeys.all()` + `frameKeys.all()` invalidated, panel unmounts (segments now exist).
- [ ] **Loading state:** Button disabled + `SpinnerIcon` while job `queued` or `running`. Adaptive polling (1s → 2s → 5s via `getJobPollingIntervalMs`).
- [ ] **Error state (job failed):** Persistent toast "Strategy failed. Try again." Button re-enables; `jobId` cleared.
- [ ] **Error state (network):** `ErrorBanner` inside panel if POST or poll throws. Button re-enables.
- [ ] **Visibility:** Panel renders only when `useSegments(showId, cycleId)` returns an empty array and is not loading. Once segments exist the panel unmounts.
- [ ] **No double-submit:** Button disabled for full duration of active job.
- [ ] **Tests:** Unit — `useRunStrategy` mutation fires correct endpoint. Component — renders button; spinner on pending; error banner on network failure; unmounts after job completes.

---

### V2-031 — Segments list + review actions + shared UI primitives (`M`)

**Task:** Create all five shared UI primitives (including `shared/ui/dialog.tsx`) and render
cycle-scoped segments as cards with approve/reject/edit affordances.

**Files:**
- `shared/ui/StatusBadge.tsx` + `.test.tsx`
- `shared/ui/ErrorBanner.tsx` + `.test.tsx`
- `shared/ui/EmptyState.tsx` + `.test.tsx`
- `shared/ui/SpinnerIcon.tsx` + `.test.tsx`
- `shared/ui/dialog.tsx` + `.test.tsx`
- `features/segments/mutations.ts` — `useApproveSegment(showId)`, `useRejectSegment(showId)`
- `features/segments/ui/SegmentCard.tsx` + `SegmentCardSkeleton`
- `features/segments/ui/SegmentList.tsx` + `SegmentListSkeleton`
- `docs/contracts/frontend-manifest.md` — flip all five shared UI items to `exists`; add segments ui row

**API calls:**
- `POST /api/segments/{id}/review` — body `{action: "approve" | "reject", reviewed_by: "producer"}`

**Acceptance criteria:**
- [ ] **Happy path:** `SegmentList` renders one `SegmentCard` per segment. Card shows: name, `StatusBadge` for `review_status`, estimated size, `definition_json` preview (collapsed), Approve + Reject buttons. Approved/rejected cards: buttons disabled, `reviewed_by` + `reviewed_at` shown.
- [ ] **Loading state:** `SegmentListSkeleton` (3 placeholder cards) while `useSegments` pending.
- [ ] **Empty state:** `EmptyState`: "No segments yet. Run the strategy agent to generate audience segments."
- [ ] **Error state:** `ErrorBanner` with retry.
- [ ] **Approve:** Single click, optimistic update to `approved`, no confirmation. Button shows "Approving…" + `SpinnerIcon`. Toast: "Segment approved". Mutation invalidates `segmentKeys.all(showId)`.
- [ ] **Reject:** Opens `Dialog` (confirm modal) with optional reason field. Button shows "Rejecting…". Toast: "Segment rejected". Mutation invalidates `segmentKeys.all(showId)`. Cancel closes without mutation.
- [ ] **Optimistic rollback:** If mutation fails, cache reverts; error toast: "Failed to approve segment. Try again or refresh the page."
- [ ] **Edit affordance:** "Edit" button visible on `pending` cards only. Hidden on approved/rejected (undo required first — V2-035). Clicking wired in V2-033.
- [ ] **Shared UI tests:** `StatusBadge` — correct label + colour per status. `ErrorBanner` — message + retry callback. `EmptyState` — message + optional CTA. `SpinnerIcon` — renders. `Dialog` — opens/closes on trigger/Escape/overlay click.
- [ ] **Tests:** `SegmentCard` — all four states; approve; reject with confirmation; rollback on error. `useApproveSegment`/`useRejectSegment` — correct endpoint + invalidation.

---

### V2-032 — Frames list + review actions (`M`)

**Task:** Same pattern as V2-031 for creative frames.

**Files:**
- `features/frames/mutations.ts` — `useApproveFrame(showId)`, `useRejectFrame(showId)`
- `features/frames/ui/FrameCard.tsx` + `FrameCardSkeleton`
- `features/frames/ui/FrameList.tsx` + `FrameListSkeleton`
- `docs/contracts/frontend-manifest.md` — add frames ui row

**API calls:**
- `POST /api/frames/{id}/review` — body `{action: "approve" | "reject", reviewed_by: "producer"}`

**Acceptance criteria:**
- [ ] **Happy path:** `FrameList` renders one `FrameCard` per frame. Card shows: hypothesis, promise, channel `StatusBadge`, risk notes (collapsed), `review_status` badge, linked segment name, Approve + Reject buttons.
- [ ] **Loading state:** `FrameListSkeleton`.
- [ ] **Empty state:** `EmptyState`: "No frames yet. Run the strategy agent to generate creative frames."
- [ ] **Error state:** `ErrorBanner` with retry.
- [ ] **Approve/reject:** Same UX rules as segments. Mutation invalidates `frameKeys.all(showId)`.
- [ ] **Linked segment name:** Derived client-side from `segment_id` against cached `useSegments` data. Shows "Unknown segment" if not found.
- [ ] **Edit affordance:** "Edit" button visible only on `pending` frames. Wired in V2-034.
- [ ] **Tests:** `FrameCard` — all four states; review actions; linked segment name; "Unknown segment" fallback.

---

### V2-033 — Segment edit modal (`M`)

**Task:** Inline edit modal for a segment. PATCH fields: `name`, `definition_json`, `estimated_size`.

**Files:**
- `features/segments/ui/SegmentEditModal.tsx`
- `features/segments/mutations.ts` — add `useUpdateSegment(showId)`
- `features/segments/ui/SegmentCard.tsx` — wire "Edit" button to open modal

**API call:** `PATCH /api/segments/{id}`

**Zod schema:**
```ts
z.object({
  name: z.string().min(1),
  definition_json: z.record(z.unknown()),
  estimated_size: z.number().int().min(0).optional(),
})
```

**Acceptance criteria:**
- [ ] **Happy path:** "Edit" on a `pending` card opens modal pre-filled. Submit: `PATCH /api/segments/{id}`, modal closes, card updates inline. Toast: "Segment saved". Mutation invalidates `segmentKeys.all(showId)`.
- [ ] **Loading state:** Submit shows "Saving…", disabled during mutation.
- [ ] **Error state (422):** Field-level errors below each input. Form NOT cleared.
- [ ] **Error state (network):** Banner inside modal. Form NOT cleared.
- [ ] **Cancel:** Escape / overlay / Cancel button closes without mutation; form resets to original values (`key` prop on modal).
- [ ] **Validation:** `name` required. `estimated_size` ≥ 0 integer if provided.
- [ ] **Edit gating:** "Edit" only on `pending` segments.
- [ ] **Tests:** Opens pre-filled; PATCH fires on submit; Cancel resets; 422 shows field error; network error shows banner.

---

### V2-034 — Frame edit modal (`M`)

**Task:** Same pattern as V2-033 for frames. PATCH fields: `hypothesis`, `promise`,
`evidence_refs`, `channel`, `risk_notes`.

**Files:**
- `features/frames/ui/FrameEditModal.tsx`
- `features/frames/mutations.ts` — add `useUpdateFrame(showId)`
- `features/frames/ui/FrameCard.tsx` — wire "Edit" button

**API call:** `PATCH /api/frames/{id}`

**Zod schema:**
```ts
z.object({
  hypothesis: z.string().min(1),
  promise: z.string().min(1),
  channel: z.string().min(1),
  evidence_refs: z.array(z.record(z.unknown())).optional(),
  risk_notes: z.string().optional(),
})
```

**Acceptance criteria:**
- [ ] **Happy path:** "Edit" on a `pending` frame card opens modal pre-filled. Submit: `PATCH /api/frames/{id}`, modal closes, card updates. Toast: "Frame saved". Mutation invalidates `frameKeys.all(showId)`.
- [ ] **Loading / error / cancel:** Same rules as V2-033.
- [ ] **Validation:** `hypothesis`, `promise`, `channel` required. `risk_notes` optional.
- [ ] **Edit gating:** Only `pending` frames.
- [ ] **Tests:** Same coverage as V2-033 applied to frame fields.

---

### V2-035 — Review undo (`S`)

**Blocked on:** Backend pre-step.

**Task:** Reset `approved` or `rejected` segment/frame back to `pending`.

**Files:**
- `features/segments/mutations.ts` — add `useUndoSegmentReview(showId)`
- `features/frames/mutations.ts` — add `useUndoFrameReview(showId)`
- `features/segments/ui/SegmentCard.tsx` — add "Undo review" button for reviewed cards
- `features/frames/ui/FrameCard.tsx` — same

**API calls:**
- `POST /api/segments/{id}/review` — body `{action: "undo", reviewed_by: "producer"}`
- `POST /api/frames/{id}/review` — body `{action: "undo", reviewed_by: "producer"}`

**Acceptance criteria:**
- [ ] **Backend pre-step shipped:** Confirm `action: "undo"` returns `review_status: "pending"` with `reviewed_at: null` before this ticket begins.
- [ ] **Happy path:** "Undo review" button on `approved`/`rejected` cards. Click: optimistic update to `pending`, re-enables Approve/Reject/Edit buttons. Toast: "Review undone".
- [ ] **Loading state:** Button shows `SpinnerIcon`, disabled while pending.
- [ ] **Error state:** Toast "Failed to undo review. Try again." Cache rolls back.
- [ ] **After undo:** Card renders as `pending` — Edit visible, Approve/Reject active, Undo gone.
- [ ] **Tests:** Undo visible only on reviewed cards; fires correct endpoint; rollback on error; card returns to pending on success.

---

### V2-036 — Experiment definition creation form (`M`)

**Task:** Form to create a new `Experiment` from an approved segment + approved frame.

**Files:**
- `features/experiments/mutations.ts` — `useCreateExperiment(showId)`
- `features/experiments/ui/ExperimentForm.tsx`
- `app/shows/[show_id]/cycles/[cycle_id]/plan/page.tsx` — mount `ExperimentForm`

**API call:** `POST /api/experiments`

**Request body:**
```
show_id           — from route param
origin_cycle_id   — from route param (cycle_id)
segment_id        — from form (approved segments only)
frame_id          — from form (approved frames for selected segment only)
channel           — from form
objective         — from form (default: "ticket_sales")
budget_cap_cents  — budget_dollars × 100
baseline_snapshot — {} (not in UI)
```

**Zod schema:**
```ts
z.object({
  segment_id: z.string().uuid(),
  frame_id: z.string().uuid(),
  channel: z.string().min(1).max(50),
  objective: z.string().min(1).default('ticket_sales'),
  budget_dollars: z.number().positive(),
})
```

**Acceptance criteria:**
- [ ] **Happy path:** Segment dropdown (approved only), frame dropdown (approved + matching segment), channel, objective, budget (dollars). Submit: POST with correct body (cents conversion). Toast: "Experiment created". Form resets. `experimentKeys.all()` invalidated.
- [ ] **Loading state (dropdowns):** Dropdowns disabled/skeleton while `useSegments`/`useFrames` pending.
- [ ] **Empty state (no approved segments):** Message below segment dropdown: "Approve at least one segment before creating an experiment." Submit disabled.
- [ ] **Empty state (no approved frames for segment):** Frame dropdown shows: "No approved frames for this segment." Submit disabled.
- [ ] **Error state (422):** Field-level errors. Form preserved.
- [ ] **Error state (network):** Banner above submit. Form preserved.
- [ ] **Frame filtering:** Dropdown re-filters on segment change. Frame selection clears on segment change.
- [ ] **`origin_cycle_id`:** From route params, not shown in UI.
- [ ] **`baseline_snapshot`:** Sent as `{}`.
- [ ] **Tests:** Dropdowns filter to approved items; frame clears on segment change; submit fires correct payload (cents); disabled when no approved segments; form resets on success.

---

### V2-037 — Plan tab test coverage (`S`)

**Task:** Integration-level test pass for all V2-030..036 flows using MSW.

**Acceptance criteria:**
- [ ] **Strategy run flow:** MSW: POST → `{job_id}`; poll `queued → running → completed`; assert `segmentKeys`/`frameKeys` invalidated; panel unmounts after segments populated.
- [ ] **Segment approve/reject/undo flows:** Optimistic update; rollback on error; confirmation dialog for reject; undo returns to pending.
- [ ] **Segment edit flow:** Modal opens pre-filled; PATCH fires; closes on success; preserves on error.
- [ ] **Frame flows:** Same coverage as segment flows.
- [ ] **Experiment creation flow:** Approved items in dropdowns; filtered frame; POST fires with correct body.
- [ ] **Quality gates:** `npm run lint`, `npm run typecheck`, `npm run test` all pass.

---

## Dependency graph

```
Backend pre-step (undo route)
  └── V2-035

V2-031 (SegmentList + shared/ui/*)   ← independent; creates shared primitives
  ├── V2-033 (SegmentEditModal)
  └── V2-036 (ExperimentForm)        ← also needs V2-032

V2-032 (FrameList)                   ← independent (uses shared/ui/* from V2-031)
  ├── V2-034 (FrameEditModal)
  └── V2-036 (ExperimentForm)

V2-030 (StrategyRunPanel)            ← independent

V2-037 (Test coverage)               ← needs V2-030..036
```

**Recommended execution order:**
1. Backend pre-step + V2-031 in parallel
2. V2-030, V2-032 in parallel (after V2-031 for shared/ui/*)
3. V2-033, V2-034 in parallel
4. V2-035 (once backend pre-step shipped)
5. V2-036
6. V2-037

---

## Open questions resolved

| # | Question | Answer |
|---|---|---|
| 1 | Backend path for review undo | Add `"undo"` to `ReviewAction` enum; handle in review route → `pending` |
| 2 | StrategyRunPanel placement | Panel renders only when segment list is empty; unmounts once segments exist |
| 3 | `shared/ui/dialog.tsx` ownership | Created in V2-031 alongside other shared UI primitives |
