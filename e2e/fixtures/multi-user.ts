/**
 * Multi-User Test Fixtures
 *
 * Fixtures for testing real-time collaboration with multiple users
 * Uses global auth state for user1, creates new contexts for other users
 */

import { test as base, Page } from '@playwright/test';
import { loginUser, waitForBoardReady } from '../helpers/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type MultiUserFixtures = {
  user1Page: Page;
  user2Page: Page;
  user3Page: Page;
  user4Page: Page;
  user5Page: Page;
};

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Extended test with multiple user pages
 * Usage: test('my test', async ({ user1Page, user2Page }) => { ... })
 */
export const test = base.extend<MultiUserFixtures>({
  user1Page: async ({ browser }, use) => {
    // User 1 uses the global auth state
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    await page.goto('/');
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user2Page: async ({ browser, user1Page }, use) => {
    // Add delay to avoid rate limiting
    await user1Page.waitForTimeout(2000);

    // User 2 needs separate auth (new anonymous user)
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page);
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user3Page: async ({ browser, user2Page }, use) => {
    // Add delay to avoid rate limiting
    await user2Page.waitForTimeout(2000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page);
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user4Page: async ({ browser, user3Page }, use) => {
    // Add delay to avoid rate limiting
    await user3Page.waitForTimeout(2000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page);
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user5Page: async ({ browser, user4Page }, use) => {
    // Add delay to avoid rate limiting
    await user4Page.waitForTimeout(2000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page);
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
