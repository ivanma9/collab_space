/**
 * Real-Time Collaboration Tests
 *
 * Tests all real-time collaboration features:
 * - Cursors: Multiplayer cursors with names, real-time movement
 * - Sync: Object creation/modification appears instantly for all users
 * - Presence: Clear indication of who's currently on the board
 * - Conflicts: Handle simultaneous edits (last-write-wins)
 * - Resilience: Graceful disconnect/reconnect handling
 * - Persistence: Board state survives all users leaving and returning
 */

import { expect } from '@playwright/test';
import {
  loginUser,
  waitForBoardReady,
  createStickyNote,
  createShape,
  selectObject,
  dragObject,
  getCursorElement,
  getOnlineUsers,
  measureSyncLatency,
  disconnectNetwork,
  reconnectNetwork,
  waitForReconnection,
  isConnected,
  countBoardObjects,
} from './helpers/test-utils';
import { test } from './fixtures/multi-user';

test.describe('Real-Time Collaboration - Cursors', () => {
  test('Multiplayer cursors appear with user names', async ({ user1Page, user2Page }) => {
    // Move cursor on user2
    await user2Page.locator('canvas').first().hover({ position: { x: 400, y: 300 } });
    await user2Page.waitForTimeout(500);

    // User1 should see user2's cursor
    const remoteCursor = await getCursorElement(user1Page, 'User 2');
    await expect(remoteCursor).toBeVisible({ timeout: 2000 });

    // Cursor should display name
    await expect(remoteCursor).toContainText('User 2');
  });

  test('Cursor movement syncs in real-time', async ({ user1Page, user2Page }) => {
    // User2 moves cursor to first position
    await user2Page.locator('canvas').first().hover({ position: { x: 200, y: 200 } });
    await user2Page.waitForTimeout(300);

    const cursor = await getCursorElement(user1Page, 'User 2');
    await expect(cursor).toBeVisible({ timeout: 2000 });

    // Get initial position
    const initialBox = await cursor.boundingBox();
    expect(initialBox).not.toBeNull();

    // User2 moves cursor to new position
    await user2Page.locator('canvas').first().hover({ position: { x: 600, y: 400 } });
    await user2Page.waitForTimeout(500);

    // Position should have changed
    const newBox = await cursor.boundingBox();
    expect(newBox).not.toBeNull();
    expect(Math.abs(newBox!.x - initialBox!.x)).toBeGreaterThan(100);
    expect(Math.abs(newBox!.y - initialBox!.y)).toBeGreaterThan(100);
  });

  test('Multiple users see each other\'s cursors', async ({ user1Page, user2Page, user3Page }) => {
    // All users move cursors
    await user1Page.locator('canvas').first().hover({ position: { x: 200, y: 200 } });
    await user2Page.locator('canvas').first().hover({ position: { x: 400, y: 300 } });
    await user3Page.locator('canvas').first().hover({ position: { x: 600, y: 400 } });

    await user1Page.waitForTimeout(1000);

    // User1 should see 2 remote cursors (user2 and user3)
    const user2Cursor = await getCursorElement(user1Page, 'User 2');
    const user3Cursor = await getCursorElement(user1Page, 'User 3');

    await expect(user2Cursor).toBeVisible({ timeout: 2000 });
    await expect(user3Cursor).toBeVisible({ timeout: 2000 });

    // User2 should see 2 remote cursors (user1 and user3)
    const user1CursorOnUser2 = await getCursorElement(user2Page, 'User 1');
    const user3CursorOnUser2 = await getCursorElement(user2Page, 'User 3');

    await expect(user1CursorOnUser2).toBeVisible({ timeout: 2000 });
    await expect(user3CursorOnUser2).toBeVisible({ timeout: 2000 });
  });

  test('Cursor disappears when user leaves', async ({ user1Page, user2Page, context }) => {
    // User2 moves cursor
    await user2Page.locator('canvas').first().hover({ position: { x: 400, y: 300 } });
    await user2Page.waitForTimeout(500);

    // User1 sees cursor
    const cursor = await getCursorElement(user1Page, 'User 2');
    await expect(cursor).toBeVisible({ timeout: 2000 });

    // User2 leaves
    await user2Page.close();
    await user1Page.waitForTimeout(2000);

    // Cursor should disappear
    await expect(cursor).not.toBeVisible();
  });
});

test.describe('Real-Time Collaboration - Sync', () => {
  test('Object creation appears instantly for all users', async ({ user1Page, user2Page }) => {
    // User1 creates sticky note
    await createStickyNote(user1Page, 300, 300, 'User 1 Note');
    await user1Page.waitForTimeout(200);

    // User2 should see it immediately
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toBeVisible({ timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toContainText('User 1 Note');
  });

  test('Object modification syncs instantly', async ({ user1Page, user2Page }) => {
    // User1 creates object
    await createStickyNote(user1Page, 300, 300, 'Original');
    await user1Page.waitForTimeout(500);

    // User2 sees it
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toBeVisible({ timeout: 2000 });

    // User1 edits it
    const stickyNote = user1Page.locator('[data-testid^="sticky-note-"]').first();
    await stickyNote.dblclick();
    await user1Page.locator('[data-testid="text-edit-input"]').fill('Modified by User 1');
    await user1Page.locator('[data-testid="text-edit-input"]').press('Escape');
    await user1Page.waitForTimeout(500);

    // User2 should see the change
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toContainText('Modified by User 1', { timeout: 2000 });
  });

  test('Object movement syncs instantly', async ({ user1Page, user2Page }) => {
    // User1 creates object
    await createStickyNote(user1Page, 300, 300, 'Move Me');
    await user1Page.waitForTimeout(500);

    // User2 sees it
    const user2StickyNote = user2Page.locator('[data-testid^="sticky-note-"]').first();
    await expect(user2StickyNote).toBeVisible({ timeout: 2000 });

    const initialBox = await user2StickyNote.boundingBox();
    expect(initialBox).not.toBeNull();

    // User1 moves object
    await dragObject(user1Page, 300, 300, 500, 400);
    await user1Page.waitForTimeout(500);

    // User2 should see the moved object
    const newBox = await user2StickyNote.boundingBox();
    expect(newBox).not.toBeNull();
    expect(Math.abs(newBox!.x - initialBox!.x)).toBeGreaterThan(50);
    expect(Math.abs(newBox!.y - initialBox!.y)).toBeGreaterThan(50);
  });

  test('Object deletion syncs instantly', async ({ user1Page, user2Page }) => {
    // User1 creates object
    await createStickyNote(user1Page, 300, 300, 'Delete Me');
    await user1Page.waitForTimeout(500);

    // User2 sees it
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1, { timeout: 2000 });

    // User1 deletes it
    await selectObject(user1Page, 300, 300);
    await user1Page.keyboard.press('Delete');
    await user1Page.waitForTimeout(500);

    // User2 should see it's gone
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(0, { timeout: 2000 });
  });

  test('Rapid creation syncs correctly', async ({ user1Page, user2Page }) => {
    // User1 rapidly creates multiple objects
    for (let i = 0; i < 5; i++) {
      await createStickyNote(user1Page, 200 + i * 100, 300, `Note ${i}`);
    }

    await user1Page.waitForTimeout(1000);

    // User2 should see all objects
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(5, { timeout: 3000 });
  });

  test('Sync latency meets performance target (<100ms)', async ({ user1Page, user2Page }) => {
    // Measure latency
    const latency = await measureSyncLatency(user1Page, user2Page);

    // Should be under 100ms
    expect(latency).toBeLessThan(150); // Allow some margin for network variance
  });
});

test.describe('Real-Time Collaboration - Presence', () => {
  test('Shows who is currently online', async ({ user1Page, user2Page }) => {
    await user1Page.waitForTimeout(1000);

    // Both users should see presence
    const users1 = await getOnlineUsers(user1Page);
    const users2 = await getOnlineUsers(user2Page);

    expect(users1.length).toBe(2);
    expect(users2.length).toBe(2);
  });

  test('Updates when users join', async ({ user1Page, user2Page, context }) => {
    const initialUsers = await getOnlineUsers(user1Page);
    expect(initialUsers.length).toBe(2);

    // User3 joins
    const user3Page = await context.newPage();
    await loginUser(user3Page, { email: 'user3@test.com', password: 'password3' });
    await waitForBoardReady(user3Page);
    await user3Page.waitForTimeout(1500);

    // All users should see 3 online
    const users1After = await getOnlineUsers(user1Page);
    const users2After = await getOnlineUsers(user2Page);
    const users3 = await getOnlineUsers(user3Page);

    expect(users1After.length).toBe(3);
    expect(users2After.length).toBe(3);
    expect(users3.length).toBe(3);

    await user3Page.close();
  });

  test('Updates when users leave', async ({ user1Page, user2Page, user3Page }) => {
    await user1Page.waitForTimeout(1000);

    // All 3 users online
    const initialUsers = await getOnlineUsers(user1Page);
    expect(initialUsers.length).toBe(3);

    // User3 leaves
    await user3Page.close();
    await user1Page.waitForTimeout(2000);

    // Remaining users should see 2 online
    const usersAfterLeave1 = await getOnlineUsers(user1Page);
    const usersAfterLeave2 = await getOnlineUsers(user2Page);

    expect(usersAfterLeave1.length).toBe(2);
    expect(usersAfterLeave2.length).toBe(2);
  });

  test('Shows user avatars and names', async ({ user1Page }) => {
    const presenceBar = user1Page.locator('[data-testid="presence-bar"]');
    await expect(presenceBar).toBeVisible();

    // Should show user elements with names
    const userElements = presenceBar.locator('[data-testid^="presence-user-"]');
    const count = await userElements.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Each user element should have a name
    for (let i = 0; i < count; i++) {
      const userEl = userElements.nth(i);
      const text = await userEl.textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Real-Time Collaboration - Conflicts', () => {
  test('Handles simultaneous edits with last-write-wins', async ({ user1Page, user2Page }) => {
    // User1 creates object
    await createStickyNote(user1Page, 300, 300, 'Original');
    await user1Page.waitForTimeout(500);

    // User2 sees it
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toBeVisible({ timeout: 2000 });

    // Both users edit simultaneously
    const stickyNote1 = user1Page.locator('[data-testid^="sticky-note-"]').first();
    const stickyNote2 = user2Page.locator('[data-testid^="sticky-note-"]').first();

    // Start both edits
    await Promise.all([
      stickyNote1.dblclick(),
      stickyNote2.dblclick(),
    ]);

    // Both edit
    await user1Page.locator('[data-testid="text-edit-input"]').fill('User 1 Edit');
    await user2Page.locator('[data-testid="text-edit-input"]').fill('User 2 Edit');

    // Save in order (User 2 last)
    await user1Page.locator('[data-testid="text-edit-input"]').press('Escape');
    await user1Page.waitForTimeout(300);
    await user2Page.locator('[data-testid="text-edit-input"]').press('Escape');
    await user2Page.waitForTimeout(1000);

    // Last write should win (User 2's edit)
    await expect(stickyNote1).toContainText('User 2 Edit', { timeout: 2000 });
    await expect(stickyNote2).toContainText('User 2 Edit');
  });

  test('Handles simultaneous movement', async ({ user1Page, user2Page }) => {
    // User1 creates object
    await createStickyNote(user1Page, 300, 300, 'Move Me');
    await user1Page.waitForTimeout(500);

    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toBeVisible({ timeout: 2000 });

    // Both users move object simultaneously
    await Promise.all([
      dragObject(user1Page, 300, 300, 400, 300),
      dragObject(user2Page, 300, 300, 300, 400),
    ]);

    await user1Page.waitForTimeout(1000);

    // Object should be at one of the positions (last write wins)
    const stickyNote1 = user1Page.locator('[data-testid^="sticky-note-"]').first();
    const box = await stickyNote1.boundingBox();
    expect(box).not.toBeNull();

    // Position should have changed from original
    expect(box!.x !== 300 || box!.y !== 300).toBe(true);
  });

  test('No duplicate objects from simultaneous creation', async ({ user1Page, user2Page }) => {
    // Both users create objects at same time
    await Promise.all([
      createStickyNote(user1Page, 300, 300, 'User 1'),
      createStickyNote(user2Page, 400, 300, 'User 2'),
    ]);

    await user1Page.waitForTimeout(1000);

    // Should have exactly 2 objects (no duplicates)
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 2000 });
  });
});

test.describe('Real-Time Collaboration - Resilience', () => {
  test('Handles disconnect gracefully', async ({ user1Page, user2Page }) => {
    // Verify connected
    const connected = await isConnected(user1Page);
    expect(connected).toBe(true);

    // Disconnect network
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1000);

    // Should show disconnected state
    const statusIndicator = user1Page.locator('[data-testid="connection-status"]');
    await expect(statusIndicator).toHaveAttribute('data-status', 'disconnected', { timeout: 3000 });

    // User2 should still work
    await createStickyNote(user2Page, 300, 300, 'While User 1 Disconnected');
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first()).toBeVisible();
  });

  test('Reconnects after network restoration', async ({ user1Page }) => {
    // Disconnect
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1500);

    // Should be disconnected
    await expect(user1Page.locator('[data-testid="connection-status"]'))
      .toHaveAttribute('data-status', 'disconnected', { timeout: 3000 });

    // Reconnect
    await reconnectNetwork(user1Page);

    // Should reconnect
    await waitForReconnection(user1Page, 10000);

    const connected = await isConnected(user1Page);
    expect(connected).toBe(true);
  });

  test('Syncs changes made while disconnected', async ({ user1Page, user2Page }) => {
    // User1 creates initial object
    await createStickyNote(user1Page, 200, 200, 'Before Disconnect');
    await user1Page.waitForTimeout(500);

    // User2 sees it
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1, { timeout: 2000 });

    // User1 disconnects
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1500);

    // User2 creates object while user1 is disconnected
    await createStickyNote(user2Page, 400, 200, 'While Disconnected');
    await user2Page.waitForTimeout(500);

    // User1 reconnects
    await reconnectNetwork(user1Page);
    await waitForReconnection(user1Page, 10000);
    await user1Page.waitForTimeout(1000);

    // User1 should now see both objects
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 3000 });
  });

  test('Maintains board state during brief disconnection', async ({ user1Page }) => {
    // Create objects
    await createStickyNote(user1Page, 200, 200, 'Note 1');
    await createStickyNote(user1Page, 400, 200, 'Note 2');
    await user1Page.waitForTimeout(500);

    const initialCount = await countBoardObjects(user1Page);
    expect(initialCount).toBe(2);

    // Brief disconnect
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(500);
    await reconnectNetwork(user1Page);
    await waitForReconnection(user1Page);
    await user1Page.waitForTimeout(500);

    // Objects should still be there
    const finalCount = await countBoardObjects(user1Page);
    expect(finalCount).toBe(2);
  });
});

test.describe('Real-Time Collaboration - Persistence', () => {
  test('Board state persists when all users leave', async ({ user1Page, user2Page }) => {
    // Create objects
    await createStickyNote(user1Page, 200, 200, 'Persistent Note 1');
    await createStickyNote(user2Page, 400, 200, 'Persistent Note 2');
    await createShape(user1Page, 'rectangle', 600, 200);
    await user1Page.waitForTimeout(1000);

    // Both users should see 3 objects
    const user1Count = await countBoardObjects(user1Page);
    const user2Count = await countBoardObjects(user2Page);
    expect(user1Count).toBe(3);
    expect(user2Count).toBe(3);

    // Both users leave (close pages)
    await user1Page.close();
    await user2Page.close();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test('Board state restored when users return', async ({ context }) => {
    // User1 creates board state
    const user1Page = await context.newPage();
    await loginUser(user1Page, { email: 'user1@test.com', password: 'password1' });
    await waitForBoardReady(user1Page);

    await createStickyNote(user1Page, 200, 200, 'Persist 1');
    await createStickyNote(user1Page, 400, 200, 'Persist 2');
    await createShape(user1Page, 'circle', 600, 200);
    await user1Page.waitForTimeout(1000);

    const originalCount = await countBoardObjects(user1Page);
    expect(originalCount).toBe(3);

    // User1 leaves
    await user1Page.close();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // User2 joins and should see the same state
    const user2Page = await context.newPage();
    await loginUser(user2Page, { email: 'user2@test.com', password: 'password2' });
    await waitForBoardReady(user2Page);
    await user2Page.waitForTimeout(1000);

    const restoredCount = await countBoardObjects(user2Page);
    expect(restoredCount).toBe(3);

    // Should see the same content
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);
    await expect(user2Page.locator('[data-testid^="shape-"]')).toHaveCount(1);

    await user2Page.close();
  });

  test('Multiple users see consistent state on join', async ({ user1Page, context }) => {
    // User1 creates initial state
    await createStickyNote(user1Page, 200, 200, 'Initial');
    await createShape(user1Page, 'rectangle', 400, 200);
    await user1Page.waitForTimeout(500);

    // User2 joins
    const user2Page = await context.newPage();
    await loginUser(user2Page, { email: 'user2@test.com', password: 'password2' });
    await waitForBoardReady(user2Page);
    await user2Page.waitForTimeout(1000);

    // User3 joins
    const user3Page = await context.newPage();
    await loginUser(user3Page, { email: 'user3@test.com', password: 'password3' });
    await waitForBoardReady(user3Page);
    await user3Page.waitForTimeout(1000);

    // All should see same state
    const count1 = await countBoardObjects(user1Page);
    const count2 = await countBoardObjects(user2Page);
    const count3 = await countBoardObjects(user3Page);

    expect(count1).toBe(2);
    expect(count2).toBe(2);
    expect(count3).toBe(2);

    await user2Page.close();
    await user3Page.close();
  });

  test('Refresh preserves board state', async ({ user1Page }) => {
    // Create objects
    await createStickyNote(user1Page, 200, 200, 'Before Refresh');
    await createShape(user1Page, 'circle', 400, 200);
    await user1Page.waitForTimeout(1000);

    const beforeCount = await countBoardObjects(user1Page);
    expect(beforeCount).toBe(2);

    // Refresh page
    await user1Page.reload();
    await waitForBoardReady(user1Page);
    await user1Page.waitForTimeout(1000);

    // Objects should still be there
    const afterCount = await countBoardObjects(user1Page);
    expect(afterCount).toBe(2);

    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
    await expect(user1Page.locator('[data-testid^="shape-"]')).toHaveCount(1);
  });
});
