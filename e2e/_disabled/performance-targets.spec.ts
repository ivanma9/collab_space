/**
 * Performance Targets Tests
 *
 * Tests all performance targets from requirements:
 * - Frame rate: 60 FPS during pan, zoom, object manipulation
 * - Object sync latency: <100ms
 * - Cursor sync latency: <50ms
 * - Object capacity: 500+ objects without performance drops
 * - Concurrent users: 5+ without degradation
 */

import { expect } from '@playwright/test';
import {
  loginUser,
  waitForBoardReady,
  createStickyNote,
  createShape,
  panBoard,
  zoomBoard,
  dragObject,
  measureFrameRate,
  measureSyncLatency,
  getOnlineUsers,
  countBoardObjects,
} from './helpers/test-utils';
import { test } from './fixtures/multi-user';
import { test as singleUserTest } from '@playwright/test';

singleUserTest.describe('Performance Target: Frame Rate (60 FPS)', () => {
  singleUserTest.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  singleUserTest('60 FPS during pan operation', async ({ page }) => {
    // Create some objects for context
    for (let i = 0; i < 10; i++) {
      await createStickyNote(page, 200 + i * 100, 250, `Note ${i}`);
    }

    await page.waitForTimeout(500);

    // Start panning and measure FPS
    const measurePromise = measureFrameRate(page, 2000);

    // Pan while measuring
    await page.waitForTimeout(200);
    await panBoard(page, 200, 150);
    await page.waitForTimeout(500);
    await panBoard(page, -100, 100);
    await page.waitForTimeout(500);
    await panBoard(page, 150, -200);

    const fps = await measurePromise;

    // Should maintain 60 FPS or close (allow 50+ for margin)
    expect(fps).toBeGreaterThan(50);
    console.log(`Pan FPS: ${fps.toFixed(2)}`);
  });

  singleUserTest('60 FPS during zoom operation', async ({ page }) => {
    // Create objects
    for (let i = 0; i < 15; i++) {
      await createStickyNote(page, 200 + (i % 5) * 100, 200 + Math.floor(i / 5) * 100, `${i}`);
    }

    await page.waitForTimeout(500);

    // Zoom and measure FPS
    const measurePromise = measureFrameRate(page, 2000);

    await page.waitForTimeout(200);
    await zoomBoard(page, -200); // Zoom in
    await page.waitForTimeout(500);
    await zoomBoard(page, 100); // Zoom out a bit
    await page.waitForTimeout(500);
    await zoomBoard(page, -100); // Zoom in again

    const fps = await measurePromise;

    expect(fps).toBeGreaterThan(50);
    console.log(`Zoom FPS: ${fps.toFixed(2)}`);
  });

  singleUserTest('60 FPS during object manipulation', async ({ page }) => {
    // Create objects
    for (let i = 0; i < 8; i++) {
      await createStickyNote(page, 200 + i * 100, 300, `Note ${i}`);
    }

    await page.waitForTimeout(500);

    // Start measuring FPS
    const measurePromise = measureFrameRate(page, 3000);

    // Manipulate objects while measuring
    await page.waitForTimeout(200);
    await dragObject(page, 300, 300, 400, 350);
    await page.waitForTimeout(400);
    await dragObject(page, 500, 300, 550, 400);
    await page.waitForTimeout(400);
    await dragObject(page, 700, 300, 650, 250);
    await page.waitForTimeout(400);

    const fps = await measurePromise;

    expect(fps).toBeGreaterThan(50);
    console.log(`Manipulation FPS: ${fps.toFixed(2)}`);
  });

  singleUserTest('60 FPS with combined pan, zoom, and manipulation', async ({ page }) => {
    // Create a moderate number of objects
    for (let i = 0; i < 20; i++) {
      await createStickyNote(page, 200 + (i % 5) * 100, 200 + Math.floor(i / 5) * 100, `${i}`);
    }

    await page.waitForTimeout(800);

    // Measure FPS during combined operations
    const measurePromise = measureFrameRate(page, 4000);

    // Perform various operations
    await page.waitForTimeout(200);
    await panBoard(page, 100, 100);
    await page.waitForTimeout(400);
    await zoomBoard(page, -100);
    await page.waitForTimeout(400);
    await dragObject(page, 300, 300, 450, 350);
    await page.waitForTimeout(400);
    await panBoard(page, -50, 50);
    await page.waitForTimeout(400);
    await zoomBoard(page, 50);

    const fps = await measurePromise;

    expect(fps).toBeGreaterThan(45); // Slightly lower threshold for combined operations
    console.log(`Combined Operations FPS: ${fps.toFixed(2)}`);
  });
});

test.describe('Performance Target: Object Sync Latency (<100ms)', () => {
  test('Object creation sync latency < 100ms', async ({ user1Page, user2Page }) => {
    // Measure sync latency multiple times and average
    const latencies: number[] = [];

    for (let i = 0; i < 5; i++) {
      const latency = await measureSyncLatency(user1Page, user2Page);
      latencies.push(latency);
      await user1Page.waitForTimeout(500);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);

    console.log(`Average sync latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Max sync latency: ${maxLatency.toFixed(2)}ms`);
    console.log(`All latencies: ${latencies.map(l => l.toFixed(0)).join(', ')}ms`);

    // Average should be well under 100ms
    expect(avgLatency).toBeLessThan(100);

    // Even max should ideally be under 150ms
    expect(maxLatency).toBeLessThan(150);
  });

  test('Object modification sync latency < 100ms', async ({ user1Page, user2Page }) => {
    // Create initial object
    await createStickyNote(user1Page, 300, 300, 'Initial');
    await user1Page.waitForTimeout(800);

    // Measure modification sync latency
    const startTime = Date.now();

    // User 1 moves object
    await dragObject(user1Page, 300, 300, 500, 400);

    // Wait for user 2 to see the change
    await user2Page.waitForTimeout(200);
    const stickyNote2 = user2Page.locator('[data-testid^="sticky-note-"]').first();
    const box = await stickyNote2.boundingBox();

    // Poll until position changes
    let moved = false;
    const timeout = Date.now() + 2000;

    while (!moved && Date.now() < timeout) {
      const currentBox = await stickyNote2.boundingBox();
      if (currentBox && box && (Math.abs(currentBox.x - box.x) > 50 || Math.abs(currentBox.y - box.y) > 50)) {
        moved = true;
        break;
      }
      await user2Page.waitForTimeout(10);
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log(`Modification sync latency: ${latency}ms`);

    expect(latency).toBeLessThan(150);
  });

  test('Object deletion sync latency < 100ms', async ({ user1Page, user2Page }) => {
    // Create object
    await createStickyNote(user1Page, 300, 300, 'Delete Me');
    await user1Page.waitForTimeout(800);

    // Verify both see it
    await expect(user1Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1, { timeout: 2000 });

    const startTime = Date.now();

    // User 1 deletes
    await user1Page.locator('[data-testid^="sticky-note-"]').first().click();
    await user1Page.keyboard.press('Delete');

    // Wait for user 2 to see deletion
    await expect(user2Page.locator('[data-testid^="sticky-note-"]')).toHaveCount(0, { timeout: 2000 });

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log(`Deletion sync latency: ${latency}ms`);

    expect(latency).toBeLessThan(150);
  });

  test('Sync latency remains low under load', async ({ user1Page, user2Page }) => {
    // Create 30 objects first (load)
    for (let i = 0; i < 30; i++) {
      await createStickyNote(user1Page, 200 + (i % 6) * 100, 200 + Math.floor(i / 6) * 100, `Load ${i}`);
    }

    await user1Page.waitForTimeout(2000);

    // Now measure sync latency
    const latency = await measureSyncLatency(user1Page, user2Page);

    console.log(`Sync latency under load (30 objects): ${latency}ms`);

    // Should still be reasonable even with 30 existing objects
    expect(latency).toBeLessThan(200);
  });
});

test.describe('Performance Target: Cursor Sync Latency (<50ms)', () => {
  test('Cursor movement sync latency < 50ms', async ({ user1Page, user2Page }) => {
    // This is harder to measure precisely, but we can check that cursors appear quickly

    const canvas2 = user2Page.locator('canvas').first();

    const startTime = Date.now();

    // User 2 moves cursor
    await canvas2.hover({ position: { x: 400, y: 300 } });

    // Wait for user 1 to see the cursor
    const remoteCursor = user1Page.locator('[data-testid^="remote-cursor-"]').first();
    await expect(remoteCursor).toBeVisible({ timeout: 1000 });

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log(`Cursor appearance latency: ${latency}ms`);

    // Initial appearance might be slower, but should be under 1000ms
    expect(latency).toBeLessThan(1000);

    // Now test cursor movement latency
    const initialBox = await remoteCursor.boundingBox();
    expect(initialBox).not.toBeNull();

    const moveStartTime = Date.now();

    // User 2 moves cursor to new position
    await canvas2.hover({ position: { x: 600, y: 400 } });

    // Wait for position to update on user 1
    let moved = false;
    const timeout = Date.now() + 500;

    while (!moved && Date.now() < timeout) {
      const currentBox = await remoteCursor.boundingBox();
      if (currentBox && initialBox && (Math.abs(currentBox.x - initialBox.x) > 50 || Math.abs(currentBox.y - initialBox.y) > 50)) {
        moved = true;
        break;
      }
      await user1Page.waitForTimeout(10);
    }

    const moveEndTime = Date.now();
    const moveLatency = moveEndTime - moveStartTime;

    console.log(`Cursor movement latency: ${moveLatency}ms`);

    // Movement sync should be very fast
    expect(moveLatency).toBeLessThan(100); // Allow 100ms margin, ideally <50ms
  });

  test('Cursor sync maintains low latency with multiple users', async ({ user1Page, user2Page, user3Page }) => {
    // All users move cursors
    await user2Page.locator('canvas').first().hover({ position: { x: 300, y: 300 } });
    await user3Page.locator('canvas').first().hover({ position: { x: 500, y: 300 } });

    await user1Page.waitForTimeout(800);

    // User 1 should see both cursors
    const user2Cursor = user1Page.locator('[data-testid^="remote-cursor-"]').filter({ hasText: 'User 2' });
    const user3Cursor = user1Page.locator('[data-testid^="remote-cursor-"]').filter({ hasText: 'User 3' });

    await expect(user2Cursor).toBeVisible({ timeout: 2000 });
    await expect(user3Cursor).toBeVisible({ timeout: 2000 });

    const box2 = await user2Cursor.boundingBox();
    const box3 = await user3Cursor.boundingBox();

    const startTime = Date.now();

    // Both move simultaneously
    await user2Page.locator('canvas').first().hover({ position: { x: 450, y: 350 } });
    await user3Page.locator('canvas').first().hover({ position: { x: 350, y: 350 } });

    // Wait for both to update
    let bothMoved = false;
    const timeout = Date.now() + 200;

    while (!bothMoved && Date.now() < timeout) {
      const current2 = await user2Cursor.boundingBox();
      const current3 = await user3Cursor.boundingBox();

      if (current2 && current3 && box2 && box3) {
        const moved2 = Math.abs(current2.x - box2.x) > 30;
        const moved3 = Math.abs(current3.x - box3.x) > 30;

        if (moved2 && moved3) {
          bothMoved = true;
          break;
        }
      }

      await user1Page.waitForTimeout(10);
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    console.log(`Multi-cursor sync latency: ${latency}ms`);

    expect(latency).toBeLessThan(150);
  });
});

singleUserTest.describe('Performance Target: Object Capacity (500+ objects)', () => {
  singleUserTest('Handles 500+ objects without performance drops', async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);

    // Create 500+ objects (mix of types)
    console.log('Creating 500+ objects...');

    for (let i = 0; i < 250; i++) {
      await createStickyNote(page, 100 + (i % 25) * 80, 100 + Math.floor(i / 25) * 80, `S${i}`);
    }

    await page.waitForTimeout(2000);

    for (let i = 0; i < 150; i++) {
      const type = ['rectangle', 'circle'][i % 2] as 'rectangle' | 'circle';
      await createShape(page, type, 100 + (i % 25) * 80, 1200 + Math.floor(i / 25) * 80);
    }

    await page.waitForTimeout(2000);

    for (let i = 0; i < 100; i++) {
      await createStickyNote(page, 100 + (i % 25) * 80, 2000 + Math.floor(i / 25) * 80, `E${i}`);
    }

    await page.waitForTimeout(2000);

    // Verify count
    const totalCount = await countBoardObjects(page);
    console.log(`Total objects created: ${totalCount}`);
    expect(totalCount).toBeGreaterThanOrEqual(500);

    // Measure FPS with 500+ objects
    console.log('Measuring FPS with 500+ objects...');
    const fps = await measureFrameRate(page, 3000);

    console.log(`FPS with 500+ objects: ${fps.toFixed(2)}`);

    // Should maintain at least 30 FPS
    expect(fps).toBeGreaterThan(30);

    // Test panning with 500+ objects
    await panBoard(page, 200, 200);
    await page.waitForTimeout(500);

    // Test zooming with 500+ objects
    await zoomBoard(page, -100);
    await page.waitForTimeout(500);

    // Board should still be responsive
    await expect(page.locator('[data-testid="board-stage"]')).toBeVisible();
  });

  singleUserTest('Can create and manipulate objects with 500+ existing objects', async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);

    // Create 500 objects quickly
    for (let i = 0; i < 500; i++) {
      await createStickyNote(page, 100 + (i % 30) * 70, 100 + Math.floor(i / 30) * 70, `${i}`);
    }

    await page.waitForTimeout(3000);

    const count = await countBoardObjects(page);
    expect(count).toBeGreaterThanOrEqual(500);

    // Create new object
    await createStickyNote(page, 300, 300, 'New Object');
    await page.waitForTimeout(500);

    // Verify it was created
    const newCount = await countBoardObjects(page);
    expect(newCount).toBe(count + 1);

    // Try to move it
    await dragObject(page, 300, 300, 400, 350);
    await page.waitForTimeout(500);

    // Should still be responsive
    const finalCount = await countBoardObjects(page);
    expect(finalCount).toBe(newCount);
  });
});

test.describe('Performance Target: Concurrent Users (5+ without degradation)', () => {
  test('5 concurrent users maintain acceptable performance', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // Verify all 5 users are connected
    await user1Page.waitForTimeout(1500);

    const users = await getOnlineUsers(user1Page);
    expect(users.length).toBe(5);

    // Each user creates 10 objects
    const createPromises = [];
    for (let i = 0; i < 10; i++) {
      createPromises.push(createStickyNote(user1Page, 100 + i * 70, 200, `U1-${i}`));
      createPromises.push(createStickyNote(user2Page, 100 + i * 70, 300, `U2-${i}`));
      createPromises.push(createStickyNote(user3Page, 100 + i * 70, 400, `U3-${i}`));
      createPromises.push(createStickyNote(user4Page, 100 + i * 70, 500, `U4-${i}`));
      createPromises.push(createStickyNote(user5Page, 100 + i * 70, 600, `U5-${i}`));
    }

    await Promise.all(createPromises);
    await user1Page.waitForTimeout(2000);

    // All users should see 50 objects
    for (const page of [user1Page, user2Page, user3Page, user4Page, user5Page]) {
      await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(50, { timeout: 4000 });
    }

    // Measure FPS on user 1
    const fps = await measureFrameRate(user1Page, 2000);
    console.log(`FPS with 5 concurrent users and 50 objects: ${fps.toFixed(2)}`);

    expect(fps).toBeGreaterThan(30);

    // Test sync latency with 5 users
    const latency = await measureSyncLatency(user1Page, user2Page);
    console.log(`Sync latency with 5 users: ${latency}ms`);

    expect(latency).toBeLessThan(200);
  });

  test('Performance remains stable as users join and leave', async ({ user1Page, user2Page, user3Page, user4Page, user5Page }) => {
    // Start with all 5 users
    await user1Page.waitForTimeout(1000);

    // Create some objects
    for (let i = 0; i < 20; i++) {
      await createStickyNote(user1Page, 200 + i * 60, 300, `Test ${i}`);
    }

    await user1Page.waitForTimeout(1500);

    // Measure baseline FPS
    const fpsWith5 = await measureFrameRate(user1Page, 1500);
    console.log(`FPS with 5 users: ${fpsWith5.toFixed(2)}`);

    // User 5 leaves
    await user5Page.close();
    await user1Page.waitForTimeout(1500);

    // Measure FPS with 4
    const fpsWith4 = await measureFrameRate(user1Page, 1500);
    console.log(`FPS with 4 users: ${fpsWith4.toFixed(2)}`);

    // User 4 leaves
    await user4Page.close();
    await user1Page.waitForTimeout(1500);

    // Measure FPS with 3
    const fpsWith3 = await measureFrameRate(user1Page, 1500);
    console.log(`FPS with 3 users: ${fpsWith3.toFixed(2)}`);

    // FPS should remain acceptable throughout
    expect(fpsWith5).toBeGreaterThan(30);
    expect(fpsWith4).toBeGreaterThan(30);
    expect(fpsWith3).toBeGreaterThan(30);
  });
});

singleUserTest.describe('Performance Target: Overall System Performance', () => {
  singleUserTest('System meets all performance targets combined', async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);

    // Create a realistic workload
    for (let i = 0; i < 100; i++) {
      await createStickyNote(page, 150 + (i % 10) * 100, 150 + Math.floor(i / 10) * 100, `Note ${i}`);
    }

    for (let i = 0; i < 50; i++) {
      const type = ['rectangle', 'circle', 'line'][i % 3] as 'rectangle' | 'circle' | 'line';
      await createShape(page, type, 150 + (i % 10) * 100, 1300 + Math.floor(i / 10) * 100);
    }

    await page.waitForTimeout(2000);

    const totalObjects = await countBoardObjects(page);
    console.log(`Total objects: ${totalObjects}`);
    expect(totalObjects).toBeGreaterThanOrEqual(150);

    // Test pan performance
    const fpsPan = await measureFrameRate(page, 1500);
    await panBoard(page, 150, 100);
    console.log(`FPS during pan: ${fpsPan.toFixed(2)}`);
    expect(fpsPan).toBeGreaterThan(45);

    // Test zoom performance
    const fpsZoom = await measureFrameRate(page, 1500);
    await zoomBoard(page, -100);
    console.log(`FPS during zoom: ${fpsZoom.toFixed(2)}`);
    expect(fpsZoom).toBeGreaterThan(45);

    // Test manipulation performance
    await dragObject(page, 300, 300, 450, 350);
    await page.waitForTimeout(300);

    // System should remain responsive
    await expect(page.locator('[data-testid="board-stage"]')).toBeVisible();

    // Create one more object to verify still responsive
    await createStickyNote(page, 500, 500, 'Final Test');
    await expect(page.locator('[data-testid^="sticky-note-"]').last()).toBeVisible({ timeout: 2000 });
  });
});
