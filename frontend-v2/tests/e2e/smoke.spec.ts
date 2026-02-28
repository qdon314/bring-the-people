import { expect, test } from '@playwright/test'

test('home page renders baseline scaffold', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'Bring the People V2' })).toBeVisible()
  await expect(page.getByText('Baseline scaffold is ready.')).toBeVisible()
})
