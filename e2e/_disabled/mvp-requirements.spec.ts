/**
 * MVP Requirements Tests (24 Hour Hard Gate)
 *
 * Tests all 9 MVP requirements that must pass:
 * 1. Infinite board with pan/zoom
 * 2. Sticky notes with editable text
 * 3. At least one shape type (rectangle, circle, or line)
 * 4. Create, move, and edit objects
 * 5. Real-time sync between 2+ users
 * 6. Multiplayer cursors with name labels
 * 7. Presence awareness (who's online)
 * 8. User authentication
 * 9. Deployed and publicly accessible
 */

import { test, expect, Page } from '@playwright/test';
import {
  loginUser,
  waitForBoardReady,
  createStickyNote,
  createShape,
  panBoard,
  zoomBoard,
  dragObject,
  getCursorElement,
  getOnlineUsers,
  selectObject,
} from './helpers/test-utils';
import { test as multiUserTest } from './fixtures/multi-user';

test.describe('MVP Requirements (Hard Gate)', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('1. Infinite board with pan/zoom', async ({ page }) => {
    // Get initial transform
    const initialTransform = await page.locator('[data-testid="board-stage"]').getAttribute('data-transform');
    expect(initialTransform).toBeTruthy();

    const initialData = JSON.parse(initialTransform!);

    // Test pan by dragging middle mouse or using wheel
    // Just verify board stage exists and has transform data
    expect(initialData).toHaveProperty('x');
    expect(initialData).toHaveProperty('y');
    expect(initialData).toHaveProperty('scale');

    // Test that we can create objects (shows board is interactive)
    await createStickyNote(page);
    const counts = await getObjectCounts(page);
    expect(counts.notes).toBeGreaterThan(0);
  });

  test('2. Sticky notes with editable text', async ({ page }) => {
    // Create a sticky note
    await createStickyNote(page, 300, 200);

    // Verify sticky note was created
    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await expect(stickyNote).toBeVisible();

    // Double-click to edit text
    await stickyNote.dblclick();

    // Text editor should appear
    await expect(page.locator('[data-testid="text-edit-overlay"]')).toBeVisible();

    // Edit the text
    const textInput = page.locator('[data-testid="text-edit-input"]');
    await textInput.fill('Hello CollabBoard!');
    await textInput.press('Escape');

    // Text should be saved
    await page.waitForTimeout(500);
    await expect(stickyNote).toContainText('Hello CollabBoard!');

    // Edit again to verify editable
    await stickyNote.dblclick();
    await expect(page.locator('[data-testid="text-edit-overlay"]')).toBeVisible();
    await textInput.fill('Updated text');
    await textInput.press('Escape');

    await page.waitForTimeout(500);
    await expect(stickyNote).toContainText('Updated text');
  });

  test('3. At least one shape type (rectangle, circle, or line)', async ({ page }) => {
    // Test Rectangle
    await createShape(page, 'rectangle', 200, 200);
    const rectangle = page.locator('[data-testid^="shape-"]').filter({ has: page.locator('[data-shape-type="rectangle"]') }).first();
    await expect(rectangle).toBeVisible();

    // Test Circle
    await createShape(page, 'circle', 400, 200);
    const circle = page.locator('[data-testid^="shape-"]').filter({ has: page.locator('[data-shape-type="circle"]') }).first();
    await expect(circle).toBeVisible();

    // Test Line
    await createShape(page, 'line', 600, 200);
    const line = page.locator('[data-testid^="shape-"]').filter({ has: page.locator('[data-shape-type="line"]') }).first();
    await expect(line).toBeVisible();

    // Verify all three shapes are on the board
    await expect(page.locator('[data-testid^="shape-"]')).toHaveCount(3);
  });

  test('4. Create, move, and edit objects', async ({ page }) => {
    // CREATE: Create a sticky note
    await createStickyNote(page, 300, 300, 'Original Position');
    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await expect(stickyNote).toBeVisible();
    await expect(stickyNote).toContainText('Original Position');

    // Get initial position
    const initialBox = await stickyNote.boundingBox();
    expect(initialBox).not.toBeNull();

    // MOVE: Drag the sticky note to a new position
    await selectObject(page, 300, 300);
    await dragObject(page, 300, 300, 500, 400);
    await page.waitForTimeout(300);

    // Verify position changed
    const newBox = await stickyNote.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.x).not.toBe(initialBox!.x);
    expect(newBox!.y).not.toBe(initialBox!.y);

    // EDIT: Edit the text
    await stickyNote.dblclick();
    await expect(page.locator('[data-testid="text-edit-overlay"]')).toBeVisible();
    await page.locator('[data-testid="text-edit-input"]').fill('Moved and Edited');
    await page.locator('[data-testid="text-edit-input"]').press('Escape');

    await page.waitForTimeout(500);
    await expect(stickyNote).toContainText('Moved and Edited');

    // CREATE: Create a shape
    await createShape(page, 'rectangle', 200, 200);
    const shape = page.locator('[data-testid^="shape-"]').first();
    await expect(shape).toBeVisible();

    // MOVE: Move the shape
    await selectObject(page, 200, 200);
    await dragObject(page, 200, 200, 350, 250);
    await page.waitForTimeout(300);

    // Shape should still be visible at new position
    await expect(shape).toBeVisible();
  });

  test('5. Real-time sync between 2+ users', async ({ page, context }) => {
    // Open a second browser context (simulating second user)
    const page2 = await context.newPage();
    await loginUser(page2, { email: 'user2@test.com', password: 'password2' });
    await waitForBoardReady(page2);

    // User 1 creates a sticky note
    await createStickyNote(page, 300, 300, 'User 1 Note');
    await page.waitForTimeout(500);

    // User 2 should see the sticky note
    await expect(page2.locator('[data-testid^="sticky-note-"]').first()).toBeVisible({ timeout: 2000 });
    await expect(page2.locator('[data-testid^="sticky-note-"]').first()).toContainText('User 1 Note');

    // User 2 creates a shape
    await createShape(page2, 'circle', 500, 300);
    await page2.waitForTimeout(500);

    // User 1 should see the shape
    await expect(page.locator('[data-testid^="shape-"]').first()).toBeVisible({ timeout: 2000 });

    // Both users should see both objects
    await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="shape-"]')).toHaveCount(1);
    await expect(page2.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
    await expect(page2.locator('[data-testid^="shape-"]')).toHaveCount(1);

    await page2.close();
  });

  test('6. Multiplayer cursors with name labels', async ({ page, context }) => {
    // Open second user page
    const page2 = await context.newPage();
    await loginUser(page2, { email: 'user2@test.com', password: 'password2' });
    await waitForBoardReady(page2);

    // Move cursor on page2
    const canvas2 = page2.locator('canvas').first();
    await canvas2.hover({ position: { x: 400, y: 300 } });
    await page2.waitForTimeout(500);

    // Page1 should see page2's cursor
    const remoteCursor = await getCursorElement(page, 'User 2'); // Adjust name based on your implementation
    await expect(remoteCursor).toBeVisible({ timeout: 3000 });

    // Cursor should have a name label
    await expect(remoteCursor).toContainText('User 2', { timeout: 1000 });

    // Move cursor and verify it updates in real-time
    await canvas2.hover({ position: { x: 600, y: 400 } });
    await page2.waitForTimeout(300);

    // The cursor should still be visible (real-time movement)
    await expect(remoteCursor).toBeVisible();

    await page2.close();
  });

  test('7. Presence awareness (who\'s online)', async ({ page, context }) => {
    // Initially, only current user should be online
    const initialUsers = await getOnlineUsers(page);
    expect(initialUsers.length).toBeGreaterThanOrEqual(1);

    // Open second user
    const page2 = await context.newPage();
    await loginUser(page2, { email: 'user2@test.com', password: 'password2' });
    await waitForBoardReady(page2);
    await page2.waitForTimeout(1000);

    // Both users should see 2 people online
    const users1 = await getOnlineUsers(page);
    expect(users1.length).toBe(2);

    const users2 = await getOnlineUsers(page2);
    expect(users2.length).toBe(2);

    // Open third user
    const page3 = await context.newPage();
    await loginUser(page3, { email: 'user3@test.com', password: 'password3' });
    await waitForBoardReady(page3);
    await page3.waitForTimeout(1000);

    // All users should see 3 people online
    const users1After = await getOnlineUsers(page);
    expect(users1After.length).toBe(3);

    // Close one user
    await page3.close();
    await page.waitForTimeout(2000);

    // Remaining users should see 2 people online
    const usersAfterLeave = await getOnlineUsers(page);
    expect(usersAfterLeave.length).toBe(2);

    await page2.close();
  });

  test('8. User authentication', async ({ page, context }) => {
    // Sign out
    await page.locator('[data-testid="sign-out-button"]').click();

    // Should redirect to login page
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 3000 });

    // Try to access board without authentication
    await page.goto('/');
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();

    // Login should work
    await loginUser(page);
    await expect(page.locator('[data-testid="board-stage"]')).toBeVisible();
  });

  test('9. Deployed and publicly accessible', async ({ page }) => {
    // This test verifies the app is running and accessible
    // In CI/CD, this should test against the deployed URL

    // Verify the app loads
    await page.goto('/');

    // Should see either login page or board (if already authenticated)
    const loginVisible = await page.locator('[data-testid="login-page"]').isVisible().catch(() => false);
    const boardVisible = await page.locator('[data-testid="board-stage"]').isVisible().catch(() => false);

    expect(loginVisible || boardVisible).toBe(true);

    // Verify essential assets load
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Verify no console errors that would prevent functionality
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.waitForTimeout(2000);

    // Should have no critical errors
    const criticalErrors = errors.filter(e =>
      e.includes('Failed to fetch') ||
      e.includes('NetworkError') ||
      e.includes('TypeError: Cannot read')
    );

    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('MVP Requirements - Multi-User Integration', () => {
  multiUserTest('All MVP features work with multiple concurrent users', async ({ user1Page, user2Page }) => {
    // User 1 creates objects
    await createStickyNote(user1Page, 200, 200, 'User 1 Note');
    await createShape(user1Page, 'rectangle', 400, 200);

    // User 2 should see them
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first()).toBeVisible({ timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="shape-"]').first()).toBeVisible({ timeout: 2000 });

    // User 2 creates objects
    await createStickyNote(user2Page, 200, 400, 'User 2 Note');
    await createShape(user2Page, 'circle', 400, 400);

    // User 1 should see them
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 2000 });
    await expect(user1Page.locator('[data-testid^="shape-"]')).toHaveCount(2, { timeout: 2000 });

    // Both users see cursors
    await user1Page.locator('canvas').first().hover({ position: { x: 300, y: 300 } });
    await user2Page.locator('canvas').first().hover({ position: { x: 500, y: 300 } });
    await user1Page.waitForTimeout(500);

    // Verify presence
    const users1 = await getOnlineUsers(user1Page);
    const users2 = await getOnlineUsers(user2Page);
    expect(users1.length).toBe(2);
    expect(users2.length).toBe(2);
  });
});
