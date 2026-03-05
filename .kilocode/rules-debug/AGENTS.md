# Debug Mode — Bring The People

## Debug workflow

1. Reproduce with explicit steps.
2. Identify root cause with file/line evidence.
3. Implement minimal fix.
4. Add regression test where practical.

## Debugging constraints

- Do not mask contract issues with frontend-only workarounds.
- Do not use timing hacks for data consistency.
- Fix source-of-truth mismatch at the correct layer.
