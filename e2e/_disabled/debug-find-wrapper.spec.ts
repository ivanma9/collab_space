import { test, expect } from '@playwright/test'

test('find wrapper element', async ({ page }) => {
  await page.goto('/')

  // Wait for login page and click guest
  await page.locator('[data-testid="guest-login-button"]').click()

  // Wait for board to load (look for text)
  await expect(page.locator('text=Cursor Sync Test')).toBeVisible({ timeout: 10000 })
  console.log('✓ Board loaded')

  // Try different ways to find the wrapper
  const byTestId = await page.locator('[data-testid="board-stage"]').count()
  console.log('By data-testid:', byTestId)

  const byCanvas = await page.locator('canvas').count()
  console.log('Canvas elements:', byCanvas)

  // Check if div with position absolute exists
  const absoluteDivs = await page.locator('div[style*="position: absolute"]').count()
  console.log('Absolute position divs:', absoluteDivs)

  // Get the HTML around canvas
  if (byCanvas > 0) {
    const canvasParent = page.locator('canvas').first().locator('..')
    const parentHtml = await canvasParent.innerHTML().catch(() => 'Could not get HTML')
    console.log('Canvas parent HTML (first 500 chars):', parentHtml.substring(0, 500))
  }

  // Check page HTML for data-testid="board-stage"
  const html = await page.content()
  const hasTestId = html.includes('data-testid="board-stage"')
  console.log('HTML contains board-stage testid:', hasTestId)

  if (hasTestId) {
    const idx = html.indexOf('data-testid="board-stage"')
    console.log('Context around testid:', html.substring(Math.max(0, idx - 200), idx + 200))
  }
})
