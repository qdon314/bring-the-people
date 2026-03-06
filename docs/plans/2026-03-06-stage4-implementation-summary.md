# Stage 4 Implementation Summary — Create Tab UI

Date: 2026-03-06  
Plan: `docs/plans/2026-03-06-stage4-create-tab.md`  
Roadmap: `docs/plans/2026-03-05-frontend-v2-roadmap.md` (Stage 4)

## Status: ✅ COMPLETE

All tasks from Stage 4 have been successfully implemented and tested.

---

## Implementation Summary

### Task 4A: Add `edited_by_human` Field to Backend ✅

**Backend changes:**
- ✅ `src/growth/domain/models.py` — Added `edited_by_human: bool = False` to `CreativeVariant`
- ✅ `src/growth/adapters/orm.py` — Added `edited_by_human: Mapped[int]` column to `CreativeVariantORM`
- ✅ `src/growth/adapters/repositories.py` — Updated `_variant_to_domain` and `_variant_to_orm` mappers
- ✅ `src/growth/app/schemas.py` — Added `edited_by_human: bool = False` to `VariantResponse`
- ✅ `src/growth/app/api/variants.py` — PATCH endpoint sets `edited_by_human = True` on any update
- ✅ Created SQL migration: `migrations_2026_03_06_add_edited_by_human.sql`

**Frontend changes:**
- ✅ Regenerated OpenAPI schema and TypeScript types
- ✅ Verified `edited_by_human: boolean` exists in generated types

**Verification:**
- ✅ Backend API returns `edited_by_human` field in `VariantResponse`
- ✅ PATCH `/api/variants/{variant_id}` automatically sets flag to `true`
- ✅ Frontend types include the field

---

### Task 4B: Wire Create Page ✅

**File:** `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx`

**Implemented:**
- ✅ Client component with state management for active jobs and selected frame
- ✅ `FramePicker` integration with `onJobsStarted` callback
- ✅ `CreativeQueue` integration with job polling and completion handlers
- ✅ `VariantGroup` integration showing variants for selected frame
- ✅ Auto-selection of frame when job completes

**State flow:**
1. User selects frames in FramePicker → clicks "Generate variants"
2. Jobs created → added to `activeJobs` state → displayed in CreativeQueue
3. Job completes (via `useJobPolling`) → removed from queue, frame ID added to `completedFrameIds`
4. Auto-select completed frame → VariantGroup displays variants

---

### Task 4C: Frame Selector ✅

**Enhanced:** `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx`

**Implemented:**
- ✅ Frame tabs above VariantGroup for switching between frames
- ✅ Tabs show frame hypothesis + channel badge
- ✅ Active tab highlighted with primary color and bottom border
- ✅ Only shows frames that have completed generation (in `completedFrameIds`)
- ✅ Clicking tab switches `selectedFrameId` state

**UX:**
- Frames appear as tabs after generation completes
- Selected frame visually indicated
- Smooth switching between frame variants

---

### Task 4D: Human Edit Badge ✅

**File:** `frontend-v2/features/variants/ui/VariantCard.tsx`

**Implemented:**
- ✅ Added conditional badge: `{variant.edited_by_human && <span>Human edited</span>}`
- ✅ Badge styled as blue pill (bg-blue-100, text-blue-800)
- ✅ Positioned after StatusBadge, before constraints badge

**Behavior:**
- Badge only shows when `edited_by_human === true`
- Appears after user edits and saves variant via VariantEditModal

---

### Task 4F: Save Behavior Verification ✅

**Backend verification:**
- ✅ `src/growth/app/api/variants.py` PATCH endpoint sets `edited_by_human = True` when any field is updated

**Frontend verification:**
- ✅ `useUpdateVariant` mutation invalidates queries, triggering refetch with updated `edited_by_human` field
- ✅ No additional frontend logic needed — backend handles flag automatically

**Flow:**
1. User clicks "Edit" on VariantCard
2. VariantEditModal opens with current values
3. User edits hook/body/cta → clicks "Save changes"
4. `useUpdateVariant` sends PATCH request
5. Backend sets `edited_by_human = True` and returns updated variant
6. Query invalidation triggers refetch
7. VariantCard re-renders with badge visible

---

### Task 4E: Integration Tests ✅

**File:** `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.test.tsx`

**Test scenarios:**
1. ✅ **Page render** — title, description, sections
2. ✅ **FramePicker loading** — renders approved frames with checkboxes
3. ✅ **Generate job flow** — select → generate → job appears in queue
4. ✅ **Job completion** — job completes → variants display
5. ✅ **Frame selector** — tabs appear after generation, clicking switches frames
6. ✅ **Variant review** — approve/reject buttons call mutations correctly
7. ✅ **Human edited badge** — shows when `edited_by_human === true`

**Mock strategy:**
- Mock `useFrames`, `useSegments`, `useVariants` queries
- Mock `useRunCreative` mutation
- Mock `useJobPolling` to simulate immediate completion
- Mock variant mutations (approve/reject/undo/update)

---

## Files Created

| Path | Purpose |
|------|---------|
| `docs/plans/2026-03-06-stage4-create-tab.md` | Implementation plan |
| `docs/plans/2026-03-06-stage4-implementation-summary.md` | This summary |
| `migrations_2026_03_06_add_edited_by_human.sql` | Database migration |
| `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx` | Create page (wired) |
| `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.test.tsx` | Integration tests |

---

## Files Modified

| Path | Changes |
|------|---------|
| `src/growth/domain/models.py` | Added `edited_by_human` field |
| `src/growth/adapters/orm.py` | Added ORM column + Boolean import |
| `src/growth/adapters/repositories.py` | Updated domain/ORM mappers |
| `src/growth/app/schemas.py` | Added field to VariantResponse |
| `src/growth/app/api/variants.py` | PATCH sets `edited_by_human = True` |
| `frontend-v2/shared/api/generated/openapi.json` | Regenerated schema |
| `frontend-v2/shared/api/generated/schema.ts` | Regenerated types |
| `frontend-v2/features/variants/ui/VariantCard.tsx` | Added human edit badge |
| `docs/contracts/frontend-manifest.md` | Updated variants + creative features |

---

## Acceptance Criteria — All Met ✅

### Task 4A
- [x] Backend `VariantResponse` schema includes `edited_by_human: bool`
- [x] API returns the field (default `false` for existing variants)
- [x] Frontend codegen produces TypeScript type with the field

### Task 4B
- [x] Happy path: Select frame → generate → job appears in queue → completes → variants display
- [x] Loading state: FramePicker shows skeleton while frames load
- [x] Empty state: "No approved frames" when no approved frames exist
- [x] Error state: Error banner with retry when frame fetch fails
- [x] Queue displays: job rows with spinner while running
- [x] Frame selection: clicking a frame with variants shows VariantGroup

### Task 4C
- [x] Frame selector shows all approved frames that have generated variants
- [x] Clicking a frame loads its variants in VariantGroup
- [x] Selected frame is visually indicated (active tab/button)
- [x] Empty state when no frame selected

### Task 4D
- [x] Variant with `edited_by_human: true` shows badge: "Human edited"
- [x] Variant with `edited_by_human: false` shows no badge
- [x] Badge is visually distinct (blue pill)

### Task 4E
- [x] All 7 test scenarios pass
- [x] Uses existing test patterns
- [x] Mocks properly configured

### Task 4F
- [x] After editing and saving a variant, subsequent fetches return `edited_by_human: true`
- [x] Human edit badge appears after save

---

## Verification Steps

### Backend

```bash
# Run backend tests
cd /path/to/repo
pytest

# Start backend server
python -m uvicorn growth.app.main:app --reload

# Test PATCH endpoint manually
curl -X PATCH http://localhost:8000/api/variants/{variant_id} \
  -H "Content-Type: application/json" \
  -d '{"hook": "Updated hook"}'
# Response should include "edited_by_human": true
```

### Frontend

```bash
cd frontend-v2

# Run unit tests
npm run test

# Run integration tests for Create page
npm run test page.test.tsx

# Build (verifies no TypeScript errors)
npm run build
```

### Database Migration

```bash
# Apply migration to existing database
sqlite3 growth.db < migrations_2026_03_06_add_edited_by_human.sql

# Verify column exists
sqlite3 growth.db "PRAGMA table_info(creative_variants);"
# Should show edited_by_human column
```

---

## Next Steps

Stage 4 is complete. Next stages from the roadmap:

- **Stage 5: Run Tab UI** (V2-050 to V2-055) — Experiment runs list, library modal, launch controls
- **Stage 6: Results Tab UI** (V2-060 to V2-065) — Observations, metrics, decisions
- **Stage 7: Memo Tab UI** (V2-070 to V2-073) — Memo generation and history
- **Stage 8: Cutover** (V2-080 to V2-083) — Full e2e tests, route swap, freeze v1

---

## Notes

- All existing components (FramePicker, CreativeQueue, VariantGroup, VariantCard, VariantEditModal) were already implemented before this plan
- This implementation focused on **wiring, integration, and the new `edited_by_human` feature**
- No breaking changes to existing APIs or components
- All tests follow existing patterns in the codebase
- Ready for PR and review
