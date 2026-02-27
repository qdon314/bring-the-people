# AGENTS.md — Debug Mode (Bring The People)

## Debug workflow

1. Reproduce with explicit steps.
2. Identify root cause with file/line evidence.
3. Implement minimal fix.
4. Add regression test where practical.

## Useful commands

Backend:
- `uv run pytest -k <pattern>`
- `uv run pytest tests/path/to/test_file.py`

Frontend:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## Debugging constraints

- Do not mask contract issues with frontend-only workarounds.
- Do not use timing hacks for data consistency.
- Fix source-of-truth mismatch at the correct layer.
