# Code Mode — Bring The People

## Code priorities

1. Contract-first: verify API routes/schemas before UI or client changes.
2. Keep workflow gates explicit (Plan → Create → Run → Results → Memo).
3. Keep status enums canonical (`pending|approved|rejected`, not `draft`).
4. Keep business logic in domain/utils, not in UI components.
