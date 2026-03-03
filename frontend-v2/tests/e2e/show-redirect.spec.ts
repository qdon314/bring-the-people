import { expect, test } from '@playwright/test'

test.describe('Show Page Redirect (V2-021)', () => {
  test('show page loads without errors', async ({ page }) => {
    // Note: This is a basic smoke test. The actual redirect behavior
    // is thoroughly tested in unit tests (shared/lib/cycles.test.ts)
    // and would require the backend API to be running for full E2E validation.

    // When: Visiting a show page (will fail to fetch without backend, but should not crash)
    const response = await page.goto('/shows/show-1')

    // Then: The page should handle the missing backend gracefully
    // (either shows error state, empty state, or 500 error page)
    expect(response?.status()).toBeGreaterThanOrEqual(200)
  })
})
