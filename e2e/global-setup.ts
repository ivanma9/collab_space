/**
 * Playwright Global Setup
 *
 * Performs one-time authentication before all tests to avoid rate limits.
 * Saves authenticated state to playwright/.auth/user.json for reuse.
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:5173';
  const authFile = path.join(__dirname, '../playwright/.auth/user.json');

  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('🔐 Performing global authentication setup...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto(baseURL);

    // Wait for either login page or board to load
    await Promise.race([
      page.locator('[data-testid="login-page"]').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
      page.locator('[data-testid="board-stage"]').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    ]);

    // Check if we're on the login page
    const loginVisible = await page.locator('[data-testid="login-page"]').isVisible().catch(() => false);

    if (loginVisible) {
      // Check for rate limit error
      const rateLimitVisible = await page.locator('text=/Request rate limit reached/i').isVisible().catch(() => false);

      if (rateLimitVisible) {
        console.warn('⚠️  Rate limit detected. Waiting 60 seconds...');
        await page.waitForTimeout(60000);
        await page.reload();
        await page.waitForTimeout(2000);

        const stillRateLimited = await page.locator('text=/Request rate limit reached/i').isVisible().catch(() => false);
        if (stillRateLimited) {
          throw new Error('Rate limit still active. Please wait 2-3 minutes before running tests again.');
        }
      }

      // Click guest login button
      console.log('🔑 Logging in as guest...');
      await page.locator('[data-testid="guest-login-button"]').click();

      // Wait for board to load after login
      await page.locator('[data-testid="board-stage"]').waitFor({ state: 'visible', timeout: 20000 });
      console.log('✅ Login successful');
    } else {
      console.log('✅ Already logged in');
    }

    // Save authenticated state
    await context.storageState({ path: authFile });
    console.log(`💾 Saved auth state to ${authFile}`);

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
