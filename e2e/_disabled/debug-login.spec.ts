import { test, expect } from '@playwright/test'

test('debug guest login', async ({ page }) => {
  await page.goto('/')

  // Check if login page is visible
  const loginPage = page.locator('[data-testid="login-page"]')
  await expect(loginPage).toBeVisible()
  console.log('✓ Login page is visible')

  // Check if guest button exists
  const guestButton = page.locator('[data-testid="guest-login-button"]')
  await expect(guestButton).toBeVisible()
  console.log('✓ Guest login button is visible')

  // Click guest login
  await guestButton.click()
  console.log('✓ Clicked guest login button')

  // Wait a bit
  await page.waitForTimeout(5000)

  // Take a screenshot
  await page.screenshot({ path: 'test-results/after-guest-login.png', fullPage: true })
  console.log('✓ Screenshot saved')

  // Check what's on the page
  const pageContent = await page.content()
  console.log('Page title:', await page.title())
  console.log('URL:', page.url())

  // Check for canvas element (Konva renders to canvas)
  const canvas = page.locator('canvas')
  const canvasCount = await canvas.count()
  console.log('Canvas elements found:', canvasCount)

  // Check for board-stage specifically
  const boardStage = page.locator('[data-testid="board-stage"]')
  const boardStageCount = await boardStage.count()
  console.log('board-stage elements found:', boardStageCount)

  // Check if there are any errors in console
  page.on('console', msg => console.log('Browser console:', msg.text()))
  page.on('pageerror', err => console.log('Page error:', err.message))
})
