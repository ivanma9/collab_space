import { test, expect } from '@playwright/test';
import { loginUser, waitForBoardReady } from './helpers/test-utils';

test.describe('Minimal Test', () => {
  test.beforeEach(async ({ page }) => {
    console.log('beforeEach: calling loginUser')
    await loginUser(page);
    console.log('beforeEach: calling waitForBoardReady')
    await waitForBoardReady(page);
    console.log('beforeEach: complete')
  });

  test('board loads', async ({ page }) => {
    console.log('test: checking board-stage')
    await expect(page.locator('[data-testid="board-stage"]')).toBeVisible();
    console.log('test: board-stage visible!')
  });
});
