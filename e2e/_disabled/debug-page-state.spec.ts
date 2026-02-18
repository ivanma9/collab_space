import { test, expect } from '@playwright/test'

test('debug page after login', async ({ page }) => {
  page.on('console', msg => console.log('Browser:', msg.text()))
  page.on('pageerror', err => console.log('Error:', err.message))

  await page.goto('/')
  console.log('1. Initial URL:', page.url())

  // Wait for login page
  await expect(page.locator('[data-testid="login-page"]')).toBeVisible()
  console.log('2. Login page visible')

  // Click guest button
  await page.locator('[data-testid="guest-login-button"]').click()
  console.log('3. Clicked guest login')

  // Wait longer
  await page.waitForTimeout(5000)

  console.log('4. After 5s - URL:', page.url())
  console.log('5. Title:', await page.title())

  // Check what's actually on the page
  const loginStillVisible = await page.locator('[data-testid="login-page"]').isVisible().catch(() => false)
  console.log('6. Login page still visible:', loginStillVisible)

  // Check for any error messages
  const errorText = await page.locator('text=/error/i').count()
  console.log('7. Error messages found:', errorText)

  // Take a screenshot
  await page.screenshot({ path: 'test-results/after-login-state.png', fullPage: true })
  console.log('8. Screenshot saved')

  // Print first 500 chars of body text
  const bodyText = await page.locator('body').textContent()
  console.log('9. Body text (first 500 chars):', bodyText?.substring(0, 500))
})
