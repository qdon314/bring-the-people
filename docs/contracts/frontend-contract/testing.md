# §7 Testing

← [Frontend Contract index](../frontend-contract.md)

### Requirement

Every code change must include or update tests in the same task. No deferred
"test later" unless explicitly approved by the user.

### Runner

Vitest is the test runner. Tests live next to the code they test using the
`.test.ts` / `.test.tsx` suffix.

```
features/segments/queries.test.ts
shared/lib/progress.test.ts
shared/api/validators/primitives.test.ts
```

### What to test

| Layer                  | Test type         | Example                                    |
|------------------------|-------------------|--------------------------------------------|
| `shared/lib/`          | Unit              | `getCycleProgress()` returns correct steps |
| `shared/api/validators/` | Unit            | Validator accepts valid, rejects malformed |
| `features/*/queries.ts`| Unit (mocked API) | Query key factory produces correct arrays  |
| `features/*/mutations.ts`| Unit (mocked API)| Mutation invalidates expected query keys  |
| `features/*/ui/*.tsx`  | Component         | Renders all four states (loading/empty/error/success) |
| `shared/ui/`           | Component         | Renders with expected props, fires callbacks|

### What NOT to test

- Next.js page routing or layout wiring (covered by build).
- Third-party library internals (Radix, TanStack Query).
- Styling / visual regression (no visual test infrastructure yet).

### Quality gates

Agents must run and pass before reporting completion:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test` (when test infrastructure is present)

If a gate is skipped, the agent must state exactly why.

### Test conventions

- Use `describe` / `it` blocks. Name tests as behavior: `it('returns approved when all segments approved')`.
- Mock API calls at the `shared/api/client.ts` boundary, not at `fetch`.
- Use `@testing-library/react` for component tests. Query by role or label, not by test ID or CSS class.
- Do not use snapshot tests for components — they break on unrelated changes and provide low signal.
- Keep tests focused: one behavior per `it` block.
