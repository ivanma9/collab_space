import { test, expect } from '@playwright/test'

test('debug guest login timing', async ({ page }) => {
  // Listen for console logs and errors
  page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('Page error:', err.message))

  await page.goto('/')
  console.log('✓ Navigated to /')

  // Check if login page is visible
  const loginPage = page.locator('[data-testid="login-page"]')
  await expect(loginPage).toBeVisible()
  console.log('✓ Login page is visible')

  // Click guest login
  const guestButton = page.locator('[data-testid="guest-login-button"]')
  await guestButton.click()
  console.log('✓ Clicked guest login button')

  // Check for canvas with longer timeout and log progress
  try {
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 })
    console.log('✓ Canvas appeared!')
  } catch (error) {
    console.log('✗ Canvas did not appear within 15 seconds')
    console.log('Current URL:', page.url())
    console.log('Page HTML:', await page.content())
    throw error
  }
})
