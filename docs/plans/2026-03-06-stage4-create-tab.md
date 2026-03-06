# Stage 4 Implementation Plan — Create Tab UI

Date: 2026-03-06  
Parent: `docs/plans/2026-03-05-frontend-v2-roadmap.md` (Stage 4)

## Overview

This plan details implementation of the Create Tab UI (`/shows/[show_id]/cycles/[cycle_id]/create`). Most components already exist — this plan focuses on wiring the page, addressing gaps, and adding test coverage.

**Pre-existing components (verified implemented):**
- `features/creative/ui/FramePicker.tsx` — filters, multi-select, job triggers
- `features/creative/ui/CreativeQueue.tsx` — job polling panel
- `features/creative/mutations.ts` — `useRunCreative`
- `features/creative/api.ts` — `runCreative`
- `features/variants/ui/VariantGroup.tsx` — grouped by platform
- `features/variants/ui/VariantCard.tsx` — approve/reject/edit actions
- `features/variants/ui/VariantEditModal.tsx` — edit modal
- `features/variants/queries.ts` — `useVariants`
- `features/variants/mutations.ts` — `useApproveVariant`, `useRejectVariant`, `useUndoVariantReview`, `useUpdateVariant`
- `features/variants/api.ts` — API functions
- `features/frames/queries.ts` — `useFrames`
- `features/segments/queries.ts` — `useSegments`
- `features/jobs/useJobPolling.ts` — job polling hook

**Known gaps:**
1. Backend lacks `edited_by_human` field in `VariantResponse` (needed for V2-045)
2. Create page is a placeholder — needs wiring
3. No integration test coverage for the tab

---

## Task Breakdown

### Task 4A: Add `edited_by_human` Field to Backend Schema

**Why:** The roadmap specifies V2-045 requires displaying `edited_by_human` metadata. The current backend `VariantResponse` lacks this field.

**Files to modify:**
- `src/growth/app/schemas.py` — Add `edited_by_human: bool` field to `VariantResponse`
- `src/growth/domain/variant.py` — Add `edited_by_human` attribute to `Variant` aggregate
- Regenerate OpenAPI schema (`python -m growth.app.main` will regenerate on startup or run codegen)

**Verification:**
- `GET /api/variants` returns `edited_by_human` boolean field
- Frontend generated schema includes the field

**Acceptance criteria:**
- [ ] Backend `VariantResponse` schema includes `edited_by_human: bool`
- [ ] API returns the field (default `false` for existing variants)
- [ ] Frontend codegen produces TypeScript type with the field

---

### Task 4B: Wire Create Page with FramePicker + CreativeQueue + VariantGroup

**Why:** The page at `app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx` is a placeholder.

**Files to modify:**
- `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx` — Replace placeholder with wired components

**Component architecture:**
```
CreatePage
├── useState: activeJobs[] = [{ frameId, jobId }]
├── useState: selectedFrameId (for variant display)
├── FramePicker (showId, cycleId, onJobsStarted)
│   └── onJobsStarted: adds to activeJobs
├── CreativeQueue (jobs: activeJobs, onJobComplete, onJobFailed)
│   └── onJobComplete/Failed: removes from activeJobs, selects frame
└── (when jobs complete) → VariantGroup (frameId: selectedFrameId)
```

**State flow:**
1. User selects frames in FramePicker → clicks "Generate variants"
2. Jobs created → added to `activeJobs` → displayed in CreativeQueue
3. Job completes → removed from `activeJobs`, `selectedFrameId` set to that frame
4. VariantGroup fetches and displays variants for selected frame

**Acceptance criteria:**
- [ ] Happy path: Select frame → generate → job appears in queue → completes → variants display
- [ ] Loading state: FramePicker shows skeleton while frames load
- [ ] Empty state: "No approved frames" when no approved frames exist
- [ ] Error state: Error banner with retry when frame fetch fails
- [ ] Queue displays: job rows with spinner while running
- [ ] Frame selection: clicking a frame with variants shows VariantGroup

---

### Task 4C: Add Frame Selector to Switch Between Variant Groups

**Why:** Users need to switch between frames to review variants for each.

**Files to modify:**
- `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx` — Add frame selector

**UI behavior:**
- Show approved frames as tabs/buttons above VariantGroup
- Selected frame highlighted
- Selecting a frame loads its variants

**Acceptance criteria:**
- [ ] Frame selector shows all approved frames that have generated variants
- [ ] Clicking a frame loads its variants in VariantGroup
- [ ] Selected frame is visually indicated (active tab/button)
- [ ] Empty state when no frame selected

---

### Task 4D: Add Human Edit Badge to VariantCard

**Why:** V2-045 requires displaying `edited_by_human` metadata in variant UI.

**Files to modify:**
- `frontend-v2/features/variants/ui/VariantCard.tsx` — Add badge when `edited_by_human` is true

**UI behavior:**
- After Edit button saves changes, backend returns variant with `edited_by_human: true`
- VariantCard displays "Edited" badge next to status

**Acceptance criteria:**
- [ ] Variant with `edited_by_human: true` shows badge: "Human edited"
- [ ] Variant with `edited_by_human: false` shows no badge
- [ ] Badge is visually distinct (e.g., blue pill)

---

### Task 4E: Add Integration Tests for Create Tab

**Why:** V2-046 requires test coverage.

**Files to create:**
- `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.test.tsx` (or `create/CreatePage.integration.test.tsx`)

**Test scenarios:**
1. **FramePicker loading** — shows skeleton while frames load
2. **FramePicker empty** — "No approved frames" empty state
3. **FramePicker with frames** — renders approved frames with checkboxes
4. **Generate job flow** — select → generate → job appears in queue
5. **Job completion** — job completes → variants appear
6. **Variant review** — approve/reject mutations work from UI
7. **Frame switch** — switch between frames shows different variants

**Mock strategy:**
- Mock `useFrames`, `useSegments`, `useRunCreative`
- Mock `useJobPolling` behavior
- Mock `useVariants` per frame
- Mock mutation responses

**Acceptance criteria:**
- [ ] All test scenarios in above list pass
- [ ] Uses existing MSW server / test utilities
- [ ] Follows existing test patterns in `features/*/ui/*.test.tsx`

---

### Task 4F: Verify VariantEditModal Saves with `edited_by_human: true`

**Why:** When a human edits a variant, the backend should mark it as human-edited.

**Files to verify/modify:**
- `frontend-v2/features/variants/mutations.ts` — `useUpdateVariant`
- Check if backend `VariantUpdate` schema includes any field to trigger `edited_by_human`

**Backend consideration:**
- If backend sets `edited_by_human = true` automatically on any PATCH, no frontend change needed
- If frontend needs to send flag, add to `VariantUpdate` schema

**Acceptance criteria:**
- [ ] After editing and saving a variant, subsequent fetches return `edited_by_human: true`
- [ ] Human edit badge appears after save

---

## Dependency Graph

```
Task 4A (backend edited_by_human)
    │
    └─► Task 4D (badge in UI) ──► Task 4E (tests)
               │
Task 4B (page wiring) ───────────┤
    │                              │
    ├─► Task 4C (frame selector) ──┤
    │                              │
    └─► Task 4F (save behavior) ──┘
```

**Parallel tracks:**
- Task 4A can proceed independently
- Tasks 4B, 4C, 4F depend on 4A only for the badge feature
- Task 4E depends on all UI tasks being complete

---

## Execution Order

1. **Task 4A** — Add backend field (backend work)
2. **Task 4B** — Wire Create page (core UI)
3. **Task 4C** — Frame selector (UX improvement)
4. **Task 4D** — Human edit badge (after 4A backend done)
5. **Task 4F** — Verify save behavior (after 4A)
6. **Task 4E** — Integration tests (last)

---

## Acceptance Criteria Summary

| Task | Deliverable | Key Acceptance |
|------|-------------|-----------------|
| 4A | Backend field | `edited_by_human` in API response |
| 4B | Wired page | Full flow: select → generate → view variants |
| 4C | Frame selector | Switch between frames shows correct variants |
| 4D | Badge UI | "Human edited" badge when field is true |
| 4E | Tests | 7 integration test scenarios pass |
| 4F | Save behavior | Edit → save → field returns true |

---

## Notes

- **No new API routes needed** — all endpoints exist (`POST /api/creative/{frame_id}/run`, `GET /api/variants`, `PATCH /api/variants/{variant_id}`)
- **No new feature folders needed** — all components exist under `features/creative/` and `features/variants/`
- **Update frontend manifest** after completing each component
