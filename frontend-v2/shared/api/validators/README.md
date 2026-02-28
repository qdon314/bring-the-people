# Runtime Response Validators

Use validators immediately after `apiClient` calls in feature `api.ts` files.

Example:

```ts
const response = await apiClient.get('/api/shows')
return validateShowListResponse(response, 'GET /api/shows')
```

Pattern:
1. Add endpoint-specific validators in this directory.
2. Accept `unknown` payload + endpoint label.
3. Throw `ApiResponseValidationError` with actionable issues.
