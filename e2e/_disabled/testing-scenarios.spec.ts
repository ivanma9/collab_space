/**
 * Testing Scenarios
 *
 * The 5 specific testing scenarios from requirements:
 * 1. 2 users editing simultaneously in different browsers
 * 2. One user refreshing mid-edit (state persistence check)
 * 3. Rapid creation and movement of sticky notes and shapes (sync performance)
 * 4. Network throttling and disconnection recovery
 * 5. 5+ concurrent users without degradation
 */

import { expect } from '@playwright/test';
import {
  loginUser,
  waitForBoardReady,
  createStickyNote,
  createShape,
  dragObject,
  selectObject,
  countBoardObjects,
  measureSyncLatency,
  throttleNetwork,
  disconnectNetwork,
  reconnectNetwork,
  waitForReconnection,
  getOnlineUsers,
  measureFrameRate,
} from './helpers/test-utils';
import { test } from './fixtures/multi-user';

test.describe('Testing Scenario 1: 2 users editing simultaneously in different browsers', () => {
  test('Both users can create, edit, and move objects simultaneously', async ({ user1Page, user2Page }) => {
    // User 1 creates and edits sticky notes
    await createStickyNote(user1Page, 200, 200, 'User 1 Note 1');
    await createStickyNote(user1Page, 200, 350, 'User 1 Note 2');

    // User 2 creates and edits sticky notes simultaneously
    await createStickyNote(user2Page, 500, 200, 'User 2 Note 1');
    await createStickyNote(user2Page, 500, 350, 'User 2 Note 2');

    await user1Page.waitForTimeout(1000);

    // Both users should see all 4 notes
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(4, { timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(4, { timeout: 2000 });

    // User 1 creates shapes while User 2 moves sticky notes
    await Promise.all([
      createShape(user1Page, 'rectangle', 300, 500),
      dragObject(user2Page, 500, 200, 600, 250),
    ]);

    await user1Page.waitForTimeout(1000);

    // Verify shape created and note moved
    await expect(user1Page.locator('[data-testid^="shape-"]')).toHaveCount(1, { timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="shape-"]')).toHaveCount(1, { timeout: 2000 });

    // Both edit different notes at the same time
    const note1User1 = user1Page.locator('[data-testid^="sticky-note-"]').first();
    const note1User2 = user2Page.locator('[data-testid^="sticky-note-"]').nth(2);

    await note1User1.dblclick();
    await note1User2.dblclick();

    await user1Page.locator('[data-testid="text-edit-input"]').fill('Edited by User 1');
    await user2Page.locator('[data-testid="text-edit-input"]').fill('Edited by User 2');

    await user1Page.locator('[data-testid="text-edit-input"]').press('Escape');
    await user2Page.locator('[data-testid="text-edit-input"]').press('Escape');

    await user1Page.waitForTimeout(1000);

    // Both edits should be visible to both users
    await expect(user1Page.getByText('Edited by User 1')).toBeVisible({ timeout: 2000 });
    await expect(user1Page.getByText('Edited by User 2')).toBeVisible({ timeout: 2000 });
    await expect(user2Page.getByText('Edited by User 1')).toBeVisible({ timeout: 2000 });
    await expect(user2Page.getByText('Edited by User 2')).toBeVisible({ timeout: 2000 });
  });

  test('Simultaneous shape creation and manipulation', async ({ user1Page, user2Page }) => {
    // Both users create shapes simultaneously
    await Promise.all([
      createShape(user1Page, 'rectangle', 200, 200),
      createShape(user2Page, 'circle', 500, 200),
    ]);

    await user1Page.waitForTimeout(800);

    // Both should see 2 shapes
    await expect(user1Page.locator('[data-testid^="shape-"]')).toHaveCount(2, { timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="shape-"]')).toHaveCount(2, { timeout: 2000 });

    // Both move their shapes simultaneously
    await Promise.all([
      dragObject(user1Page, 200, 200, 300, 300),
      dragObject(user2Page, 500, 200, 400, 300),
    ]);

    await user1Page.waitForTimeout(800);

    // Shapes should still exist and be visible
    await expect(user1Page.locator('[data-testid^="shape-"]')).toHaveCount(2);
    await expect(user2Page.locator('[data-testid^="shape-"]')).toHaveCount(2);
  });

  test('No race conditions or lost updates', async ({ user1Page, user2Page }) => {
    // Create 10 objects from each user rapidly
    const promises = [];

    for (let i = 0; i < 10; i++) {
      promises.push(createStickyNote(user1Page, 150 + i * 50, 200, `U1-${i}`));
      promises.push(createStickyNote(user2Page, 150 + i * 50, 400, `U2-${i}`));
    }

    await Promise.all(promises);
    await user1Page.waitForTimeout(2000);

    // Should have exactly 20 objects, no duplicates or missing items
    const count1 = await countBoardObjects(user1Page);
    const count2 = await countBoardObjects(user2Page);

    expect(count1).toBe(20);
    expect(count2).toBe(20);
  });
});

test.describe('Testing Scenario 2: One user refreshing mid-edit (state persistence check)', () => {
  test('Refresh during sticky note editing preserves state', async ({ user1Page }) => {
    // Create sticky note
    await createStickyNote(user1Page, 300, 300, 'Before Refresh');
    await user1Page.waitForTimeout(500);

    // Start editing
    const stickyNote = user1Page.locator('[data-testid^="sticky-note-"]').first();
    await stickyNote.dblclick();

    await user1Page.locator('[data-testid="text-edit-input"]').fill('Editing in progress');
    // Don't save yet - refresh while editing
    await user1Page.reload();

    await waitForBoardReady(user1Page);
    await user1Page.waitForTimeout(1000);

    // Original state should be preserved (unsaved changes are lost, which is expected)
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
    await expect(stickyNote).toContainText('Before Refresh');
  });

  test('Refresh after save preserves edited state', async ({ user1Page }) => {
    // Create and edit sticky note
    await createStickyNote(user1Page, 300, 300, 'Original');
    await user1Page.waitForTimeout(500);

    const stickyNote = user1Page.locator('[data-testid^="sticky-note-"]').first();
    await stickyNote.dblclick();

    await user1Page.locator('[data-testid="text-edit-input"]').fill('Saved Before Refresh');
    await user1Page.locator('[data-testid="text-edit-input"]').press('Escape');

    await user1Page.waitForTimeout(1000);

    // Refresh
    await user1Page.reload();
    await waitForBoardReady(user1Page);
    await user1Page.waitForTimeout(1000);

    // Edited state should be preserved
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
    await expect(stickyNote).toContainText('Saved Before Refresh');
  });

  test('Refresh while dragging object preserves last saved position', async ({ user1Page }) => {
    // Create object
    await createStickyNote(user1Page, 200, 200, 'Draggable');
    await user1Page.waitForTimeout(500);

    // Start dragging
    await selectObject(user1Page, 200, 200);
    const canvas = user1Page.locator('canvas').first();
    await canvas.hover({ position: { x: 200, y: 200 } });
    await user1Page.mouse.down();

    // Refresh mid-drag
    await user1Page.reload();
    await waitForBoardReady(user1Page);
    await user1Page.waitForTimeout(1000);

    // Object should still exist at original position (drag wasn't saved)
    const stickyNote = user1Page.locator('[data-testid^="sticky-note-"]').first();
    await expect(stickyNote).toBeVisible();
  });

  test('Multiple objects survive refresh', async ({ user1Page }) => {
    // Create multiple objects of different types
    await createStickyNote(user1Page, 200, 200, 'Note 1');
    await createStickyNote(user1Page, 400, 200, 'Note 2');
    await createShape(user1Page, 'rectangle', 200, 400);
    await createShape(user1Page, 'circle', 400, 400);

    await user1Page.waitForTimeout(1000);

    const beforeCount = await countBoardObjects(user1Page);
    expect(beforeCount).toBe(4);

    // Refresh
    await user1Page.reload();
    await waitForBoardReady(user1Page);
    await user1Page.waitForTimeout(1000);

    // All objects should be restored
    const afterCount = await countBoardObjects(user1Page);
    expect(afterCount).toBe(4);

    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);
    await expect(user1Page.locator('[data-testid^="shape-"]')).toHaveCount(2);
  });

  test('Refresh during multi-user collaboration preserves state', async ({ user1Page, user2Page }) => {
    // Both users create objects
    await createStickyNote(user1Page, 200, 200, 'User 1');
    await createStickyNote(user2Page, 400, 200, 'User 2');

    await user1Page.waitForTimeout(1000);

    // Verify both see 2 objects
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 2000 });
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);

    // User 1 refreshes
    await user1Page.reload();
    await waitForBoardReady(user1Page);
    await user1Page.waitForTimeout(1000);

    // User 1 should still see both objects
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);

    // User 2 creates another object while User 1 was refreshing
    await createStickyNote(user2Page, 600, 200, 'After Refresh');
    await user2Page.waitForTimeout(500);

    // User 1 should see the new object
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(3, { timeout: 2000 });
  });
});

test.describe('Testing Scenario 3: Rapid creation and movement (sync performance)', () => {
  test('Rapid sticky note creation syncs correctly', async ({ user1Page, user2Page }) => {
    // User 1 rapidly creates 20 sticky notes
    for (let i = 0; i < 20; i++) {
      await createStickyNote(user1Page, 200 + (i % 5) * 100, 200 + Math.floor(i / 5) * 100, `Rapid ${i}`);
    }

    // Wait for sync
    await user1Page.waitForTimeout(2000);

    // User 2 should see all 20 notes
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(20, { timeout: 3000 });

    // No duplicates - count should be exactly 20
    const count = await countBoardObjects(user2Page);
    expect(count).toBe(20);
  });

  test('Rapid shape creation syncs correctly', async ({ user1Page, user2Page }) => {
    // Create 15 shapes rapidly, alternating types
    for (let i = 0; i < 15; i++) {
      const type = ['rectangle', 'circle', 'line'][i % 3] as 'rectangle' | 'circle' | 'line';
      await createShape(user1Page, type, 200 + (i % 5) * 100, 200 + Math.floor(i / 5) * 100);
    }

    await user1Page.waitForTimeout(2000);

    // User 2 should see all 15 shapes
    await expect(user2Page.locator('[data-testid^="shape-"]')).toHaveCount(15, { timeout: 3000 });
  });

  test('Rapid object movement maintains sync', async ({ user1Page, user2Page }) => {
    // Create objects
    for (let i = 0; i < 5; i++) {
      await createStickyNote(user1Page, 200 + i * 100, 300, `Note ${i}`);
    }

    await user1Page.waitForTimeout(1000);

    // User 2 sees them
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(5, { timeout: 2000 });

    // User 1 rapidly moves them
    for (let i = 0; i < 5; i++) {
      await dragObject(user1Page, 200 + i * 100, 300, 200 + i * 100, 500);
    }

    await user1Page.waitForTimeout(1500);

    // All movements should sync to User 2
    // Verify objects still exist (moved position)
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(5);
  });

  test('High-frequency updates maintain performance', async ({ user1Page }) => {
    // Create objects
    for (let i = 0; i < 30; i++) {
      await createStickyNote(user1Page, 200 + (i % 6) * 100, 200 + Math.floor(i / 6) * 100, `P${i}`);
    }

    await user1Page.waitForTimeout(1000);

    // Measure FPS during rapid interactions
    const fps = await measureFrameRate(user1Page, 2000);

    // Should maintain at least 30 FPS even with 30 objects
    expect(fps).toBeGreaterThan(30);
  });

  test('Sync latency remains low during rapid updates', async ({ user1Page, user2Page }) => {
    // Create some baseline objects
    for (let i = 0; i < 10; i++) {
      await createStickyNote(user1Page, 200 + i * 80, 250, `Base ${i}`);
    }

    await user1Page.waitForTimeout(1000);

    // Measure sync latency during rapid creation
    const latency = await measureSyncLatency(user1Page, user2Page);

    // Should still be under 150ms even with existing objects
    expect(latency).toBeLessThan(150);
  });
});

test.describe('Testing Scenario 4: Network throttling and disconnection recovery', () => {
  test('Handles slow 3G network', async ({ user1Page, user2Page }) => {
    // Throttle to Slow 3G (500kbps down, 500kbps up, 400ms latency)
    await throttleNetwork(user1Page, 500, 500, 400);

    // User 1 creates object on slow network
    await createStickyNote(user1Page, 300, 300, 'Slow Network');
    await user1Page.waitForTimeout(500);

    // User 2 (normal network) should still receive it
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toBeVisible({ timeout: 3000 });
    await expect(user2Page.locator('[data-testid^="sticky-note-"]').first())
      .toContainText('Slow Network');
  });

  test('Recovers from complete disconnection', async ({ user1Page, user2Page }) => {
    // Create initial state
    await createStickyNote(user1Page, 200, 200, 'Before Disconnect');
    await user1Page.waitForTimeout(500);

    // User 2 sees it
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1, { timeout: 2000 });

    // Disconnect User 1
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1500);

    // User 2 creates object while User 1 is offline
    await createStickyNote(user2Page, 400, 200, 'While Offline');
    await user2Page.waitForTimeout(500);

    // Reconnect User 1
    await reconnectNetwork(user1Page);
    await waitForReconnection(user1Page, 10000);
    await user1Page.waitForTimeout(1500);

    // User 1 should now see both objects
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 3000 });
  });

  test('Handles intermittent connectivity', async ({ user1Page, user2Page }) => {
    // Create object
    await createStickyNote(user1Page, 300, 300, 'Test 1');
    await user1Page.waitForTimeout(500);

    // Disconnect
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1000);

    // Reconnect
    await reconnectNetwork(user1Page);
    await waitForReconnection(user1Page);
    await user1Page.waitForTimeout(500);

    // Create another object
    await createStickyNote(user1Page, 300, 400, 'Test 2');
    await user1Page.waitForTimeout(500);

    // Disconnect again
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1000);

    // Reconnect again
    await reconnectNetwork(user1Page);
    await waitForReconnection(user1Page);
    await user1Page.waitForTimeout(1000);

    // Both objects should still be there and synced
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2, { timeout: 3000 });
  });

  test('UI indicates connection status accurately', async ({ user1Page }) => {
    // Initially connected
    const statusIndicator = user1Page.locator('[data-testid="connection-status"]');
    await expect(statusIndicator).toHaveAttribute('data-status', 'connected');

    // Disconnect
    await disconnectNetwork(user1Page);
    await user1Page.waitForTimeout(1500);

    // Should show disconnected
    await expect(statusIndicator).toHaveAttribute('data-status', 'disconnected', { timeout: 3000 });

    // Reconnect
    await reconnectNetwork(user1Page);
    await user1Page.waitForTimeout(2000);

    // Should show connected
    await expect(statusIndicator).toHaveAttribute('data-status', 'connected', { timeout: 5000 });
  });
});

test.describe('Testing Scenario 5: 5+ concurrent users without degradation', () => {
  test('5 concurrent users can all interact simultaneously', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // All 5 users create objects simultaneously
    await Promise.all([
      createStickyNote(user1Page, 200, 200, 'User 1'),
      createStickyNote(user2Page, 400, 200, 'User 2'),
      createStickyNote(user3Page, 600, 200, 'User 3'),
      createShape(user4Page, 'rectangle', 200, 400),
      createShape(user5Page, 'circle', 400, 400),
    ]);

    await user1Page.waitForTimeout(2000);

    // All users should see all 5 objects
    for (const page of [user1Page, user2Page, user3Page, user4Page, user5Page]) {
      const count = await countBoardObjects(page);
      expect(count).toBe(5);
    }
  });

  test('Presence shows all 5 users online', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    await user1Page.waitForTimeout(1500);

    // Check presence on each user's page
    const users1 = await getOnlineUsers(user1Page);
    const users2 = await getOnlineUsers(user2Page);
    const users3 = await getOnlineUsers(user3Page);

    expect(users1.length).toBe(5);
    expect(users2.length).toBe(5);
    expect(users3.length).toBe(5);
  });

  test('Each user sees 4 other cursors', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // All users move their cursors
    await user1Page.locator('canvas').first().hover({ position: { x: 200, y: 200 } });
    await user2Page.locator('canvas').first().hover({ position: { x: 300, y: 200 } });
    await user3Page.locator('canvas').first().hover({ position: { x: 400, y: 200 } });
    await user4Page.locator('canvas').first().hover({ position: { x: 500, y: 200 } });
    await user5Page.locator('canvas').first().hover({ position: { x: 600, y: 200 } });

    await user1Page.waitForTimeout(1500);

    // User 1 should see 4 remote cursors
    const remoteCursors = user1Page.locator('[data-testid^="remote-cursor-"]');
    const cursorCount = await remoteCursors.count();

    expect(cursorCount).toBe(4);
  });

  test('Performance remains acceptable with 5 users', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // Each user creates multiple objects
    for (let i = 0; i < 5; i++) {
      await createStickyNote(user1Page, 200 + i * 50, 200, `U1-${i}`);
      await createStickyNote(user2Page, 200 + i * 50, 300, `U2-${i}`);
      await createStickyNote(user3Page, 200 + i * 50, 400, `U3-${i}`);
      await createStickyNote(user4Page, 200 + i * 50, 500, `U4-${i}`);
      await createStickyNote(user5Page, 200 + i * 50, 600, `U5-${i}`);
    }

    await user1Page.waitForTimeout(2000);

    // All users should have 25 objects
    for (const page of [user1Page, user2Page, user3Page, user4Page, user5Page]) {
      await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(25, { timeout: 3000 });
    }

    // Measure FPS on one user
    const fps = await measureFrameRate(user1Page, 2000);

    // Should maintain at least 30 FPS even with 5 users and 25 objects
    expect(fps).toBeGreaterThan(30);
  });

  test('Sync latency acceptable with 5 concurrent users', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // Measure sync latency with 5 users active
    const latency = await measureSyncLatency(user1Page, user2Page);

    // Should still be under 200ms with 5 users
    expect(latency).toBeLessThan(200);
  });

  test('No degradation when users join and leave', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // All 5 users online
    const initial5 = await getOnlineUsers(user1Page);
    expect(initial5.length).toBe(5);

    // User 5 leaves
    await user5Page.close();
    await user1Page.waitForTimeout(2000);

    // Should show 4 online
    const after4 = await getOnlineUsers(user1Page);
    expect(after4.length).toBe(4);

    // User 4 leaves
    await user4Page.close();
    await user1Page.waitForTimeout(2000);

    // Should show 3 online
    const after3 = await getOnlineUsers(user1Page);
    expect(after3.length).toBe(3);

    // Remaining users can still interact normally
    await createStickyNote(user1Page, 300, 300, 'After users left');
    await user1Page.waitForTimeout(500);

    await expect(user2Page.locator('[data-testid^="sticky-note-"]').last())
      .toBeVisible({ timeout: 2000 });
  });
});
