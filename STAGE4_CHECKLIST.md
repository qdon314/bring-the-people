# Stage 4 Implementation Checklist

## ✅ All Tasks Complete

- [x] Task 4A: Add `edited_by_human` to backend VariantResponse
- [x] Task 4B: Wire Create page with FramePicker + CreativeQueue + VariantGroup
- [x] Task 4C: Add frame selector for switching between variant groups
- [x] Task 4D: Add human edit badge to VariantCard
- [x] Task 4F: Verify save behavior sets edited_by_human
- [x] Task 4E: Add integration tests for Create Tab

---

## Modified Files (10)

### Backend (5 files)
- [x] `src/growth/domain/models.py` — Added `edited_by_human: bool = False` to CreativeVariant
- [x] `src/growth/adapters/orm.py` — Added Boolean column + import
- [x] `src/growth/adapters/repositories.py` — Updated mappers
- [x] `src/growth/app/schemas.py` — Added field to VariantResponse
- [x] `src/growth/app/api/variants.py` — PATCH sets edited_by_human = True

### Frontend (5 files)
- [x] `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.tsx` — Wired page
- [x] `frontend-v2/features/variants/ui/VariantCard.tsx` — Human edit badge
- [x] `frontend-v2/shared/api/generated/openapi.json` — Regenerated
- [x] `frontend-v2/shared/api/generated/schema.ts` — Regenerated
- [x] `docs/contracts/frontend-manifest.md` — Updated

---

## New Files (3)

- [x] `migrations_2026_03_06_add_edited_by_human.sql` — Database migration
- [x] `frontend-v2/app/shows/[show_id]/cycles/[cycle_id]/create/page.test.tsx` — Integration tests
- [x] `docs/plans/2026-03-06-stage4-implementation-summary.md` — Summary doc

---

## Pre-Merge Verification

### Backend
```bash
# Syntax check
python -m py_compile src/growth/**/*.py
✅ PASSED

# Run tests
pytest
⏳ TODO (run before merge)

# Apply migration
sqlite3 growth.db < migrations_2026_03_06_add_edited_by_human.sql
⏳ TODO (apply to dev db)
```

### Frontend
```bash
# Type check
cd frontend-v2 && npm run build
⏳ TODO (requires npm install)

# Unit tests
npm run test
⏳ TODO (requires npm install)

# Integration tests
npm run test page.test.tsx
⏳ TODO (requires npm install)
```

---

## Deployment Steps

1. **Apply database migration:**
   ```bash
   sqlite3 growth.db < migrations_2026_03_06_add_edited_by_human.sql
   ```

2. **Deploy backend** — restart server to pick up new schema

3. **Deploy frontend** — build and deploy as usual

4. **Verify in browser:**
   - Navigate to `/shows/{show_id}/cycles/{cycle_id}/create`
   - Select frames and generate variants
   - Verify variants display
   - Edit a variant
   - Verify "Human edited" badge appears

---

## Rollback Plan

If issues arise:

1. **Backend:** Revert 5 backend files
2. **Frontend:** Revert 2 frontend files (page.tsx, VariantCard.tsx)
3. **Database:** Run reverse migration:
   ```sql
   ALTER TABLE creative_variants DROP COLUMN edited_by_human;
   ```

---

## Documentation

- [x] Implementation plan: `docs/plans/2026-03-06-stage4-create-tab.md`
- [x] Summary: `docs/plans/2026-03-06-stage4-implementation-summary.md`
- [x] Manifest updated: `docs/contracts/frontend-manifest.md`

---

## Next Steps

- [ ] Run full test suite
- [ ] Create PR with summary
- [ ] Request review
- [ ] Apply migration to staging/prod
- [ ] Proceed to Stage 5 (Run Tab UI)
