# Kilo Code — Project Rules (Behavioral)

These rules reduce churn and keep work reviewable. Follow unless explicitly overridden by the user.

## 1) Batch edits
- Plan first, then apply cohesive edits in deliberate passes.
- Avoid rapid file hopping for related changes.
- Keep each patch scoped to a clear objective.

## 2) Command discipline
- Prefer repo-native commands that actually exist in this project.
- Backend: use `uv run ...` (for app and tests).
- Frontend (v1): run npm commands from `frontend/`.
- Frontend (v2): run npm commands from `frontend-v2/`.
- Do not rely on non-existent wrappers like `make` or `./scripts/py` unless added later.

## 3) Contract discipline
- Do not invent API endpoints or payload shapes.
- Verify against `src/growth/app/api/*.py` and `src/growth/app/schemas.py`.
- Keep status values canonical and consistent across backend/frontend.

## 4) Git behavior
- Do not auto-commit.
- Do not add attribution lines like `Co-authored-by`.
- Do not revert unrelated local changes.
- At completion, provide suggested commits (message + files).

## 5) Manifest discipline
- After adding shared components, utilities, or hooks to `frontend-v2/`, update `docs/contracts/frontend-manifest.md`.
- This is part of the definition of done — code is not complete until the manifest reflects it.
