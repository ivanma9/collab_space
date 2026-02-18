/**
 * Multi-User Test Fixtures
 *
 * Fixtures for testing real-time collaboration with multiple users
 */

import { test as base, Page } from '@playwright/test';
import { loginUser, waitForBoardReady } from '../helpers/test-utils';

type MultiUserFixtures = {
  user1Page: Page;
  user2Page: Page;
  user3Page: Page;
  user4Page: Page;
  user5Page: Page;
};

/**
 * Extended test with multiple user pages
 * Usage: test('my test', async ({ user1Page, user2Page }) => { ... })
 */
export const test = base.extend<MultiUserFixtures>({
  user1Page: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page, { guestName: 'User 1' });
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user2Page: async ({ browser, user1Page }, use) => {
    // Add delay to avoid rate limiting
    await user1Page.waitForTimeout(1000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page, { guestName: 'User 2' });
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user3Page: async ({ browser, user2Page }, use) => {
    // Add delay to avoid rate limiting
    await user2Page.waitForTimeout(1000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page, { guestName: 'User 3' });
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user4Page: async ({ browser, user3Page }, use) => {
    // Add delay to avoid rate limiting
    await user3Page.waitForTimeout(1000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page, { guestName: 'User 4' });
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },

  user5Page: async ({ browser, user4Page }, use) => {
    // Add delay to avoid rate limiting
    await user4Page.waitForTimeout(1000);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUser(page, { guestName: 'User 5' });
    await waitForBoardReady(page);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
