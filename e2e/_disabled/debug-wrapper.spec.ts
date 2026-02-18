import { test, expect } from '@playwright/test'
import { loginUser } from './helpers/test-utils'

test('debug wrapper div', async ({ page }) => {
  // Login
  await loginUser(page)

  // Wait a bit
  await page.waitForTimeout(2000)

  // Check for wrapper div
  const wrapperDiv = page.locator('[data-testid="board-stage"]')
  const wrapperCount = await wrapperDiv.count()
  console.log('Wrapper divs found:', wrapperCount)

  if (wrapperCount > 0) {
    const isVisible = await wrapperDiv.isVisible()
    console.log('Is visible:', isVisible)
    const transform = await wrapperDiv.getAttribute('data-transform')
    console.log('Transform:', transform)
  }

  // Check for canvas
  const canvas = page.locator('canvas')
  const canvasCount = await canvas.count()
  console.log('Canvas elements found:', canvasCount)

  // Take screenshot
  await page.screenshot({ path: 'test-results/wrapper-test.png', fullPage: true })

  // Dump page content
  const html = await page.content()
  console.log('Board stage in HTML:', html.includes('board-stage'))
})
