/**
 * E2E Test Utilities
 *
 * Helper functions and utilities for Playwright E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Login helper - authenticates a user as guest
 */
export async function loginUser(page: Page, _options?: { guestName?: string }) {
  await page.goto('/');

  // Wait for either login page or dashboard to load
  await Promise.race([
    page.locator('[data-testid="login-page"]').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    page.locator('[data-testid="dashboard"]').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
  ]);

  // Check if we're on the login page
  const loginVisible = await page.locator('[data-testid="login-page"]').isVisible().catch(() => false);

  if (loginVisible) {
    // Check for rate limit error
    let rateLimitVisible = await page.locator('text=/Request rate limit reached/i').isVisible().catch(() => false);

    if (rateLimitVisible) {
      console.log('Rate limit detected, waiting 60 seconds for reset...');
      // Supabase rate limits can last 60+ seconds
      await page.waitForTimeout(60000);

      // Reload and check again
      await page.reload();
      await page.waitForTimeout(2000);

      rateLimitVisible = await page.locator('text=/Request rate limit reached/i').isVisible().catch(() => false);
      if (rateLimitVisible) {
        throw new Error('Rate limit still active after 60s wait. Please wait before running tests again.');
      }
    }

    // Click guest login button
    await page.locator('[data-testid="guest-login-button"]').click();

    // Wait for dashboard to load after login
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 20000 });
  }
  // If not on login page, we're already logged in
}

/**
 * Login with Google OAuth (if implemented)
 */
export async function loginWithGoogle(page: Page) {
  await page.goto('/');
  await page.locator('[data-testid="google-login-button"]').click();

  // Handle OAuth flow (this depends on your implementation)
  // You may need to use a test account or mock OAuth
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 15000 });
}

/**
 * Navigate to a board. Creates a new board if on the dashboard with no boards.
 */
export async function navigateToBoard(page: Page) {
  // Wait for page to settle
  await page.waitForTimeout(1000);

  // If already on a board, nothing to do
  const onBoard = await page.locator('[data-testid="board-stage"]').isVisible().catch(() => false);
  if (onBoard) return;

  // If on dashboard, create a new board
  const dashboard = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);
  if (dashboard) {
    await page.locator('[data-testid="new-board-name-input"]').fill('E2E Test Board');
    await page.locator('[data-testid="create-board-button"]').click();
    await page.waitForURL(/\/board\//, { timeout: 15000 });
  }

  await expect(page.locator('[data-testid="board-stage"]')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(500); // Small delay for canvas initialization
}

/**
 * Wait for board to be fully loaded and ready
 */
export async function waitForBoardReady(page: Page) {
  await navigateToBoard(page);
}

/**
 * Create a sticky note - uses hidden data-testid affordance to track count
 */
export async function createStickyNote(page: Page, _x?: number, _y?: number, text?: string) {
  // Get initial count from data attribute
  const el = page.locator('[data-testid="object-counts"]');
  const beforeCount = parseInt((await el.getAttribute('data-notes')) ?? '0');

  // Click the sticky note tool button
  await page.locator('[data-testid="sticky-note-tool"]').click();

  // Poll data-notes attribute until it increases
  await expect(async () => {
    const current = parseInt((await el.getAttribute('data-notes')) ?? '0');
    expect(current).toBeGreaterThan(beforeCount);
  }).toPass({ timeout: 5000 });

  await page.waitForTimeout(300);

  // If text provided, double-click on canvas to edit the note
  if (text) {
    await page.mouse.dblclick(700, 400);
    await page.waitForTimeout(200);

    const overlayVisible = await page.locator('[data-testid="text-edit-overlay"]').isVisible().catch(() => false);
    if (overlayVisible) {
      await page.locator('[data-testid="text-edit-input"]').fill(text);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  }
}

/**
 * Create a shape - opens flyout first, then clicks tool, polls data-shapes
 */
export async function createShape(page: Page, type: 'rectangle' | 'circle' | 'line', _x?: number, _y?: number) {
  // Get initial count from data attribute
  const el = page.locator('[data-testid="object-counts"]');
  const beforeCount = parseInt((await el.getAttribute('data-shapes')) ?? '0');

  // Open shapes flyout first, then click the specific shape tool
  await page.locator('[data-testid="shapes-flyout-trigger"]').click();
  await page.waitForTimeout(200);
  await page.locator(`[data-testid="${type}-tool"]`).click();

  // Poll data-shapes attribute until it increases
  await expect(async () => {
    const current = parseInt((await el.getAttribute('data-shapes')) ?? '0');
    expect(current).toBeGreaterThan(beforeCount);
  }).toPass({ timeout: 5000 });

  await page.waitForTimeout(300);
}

/**
 * Create a frame at specified position
 */
export async function createFrame(page: Page, x: number, y: number, title?: string) {
  await page.locator('[data-testid="frame-tool"]').click();

  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x, y } });

  if (title) {
    await expect(page.locator('[data-testid="text-edit-overlay"]')).toBeVisible();
    await page.locator('[data-testid="text-edit-input"]').fill(title);
    await page.locator('[data-testid="text-edit-input"]').press('Escape');
  }

  await page.waitForTimeout(200);
}

/**
 * Create a connector between two objects
 */
export async function createConnector(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.locator('[data-testid="connector-tool"]').click();

  const canvas = page.locator('canvas').first();
  // Click first object
  await canvas.click({ position: { x: fromX, y: fromY } });
  // Click second object
  await canvas.click({ position: { x: toX, y: toY } });

  await page.waitForTimeout(200);
}

/**
 * Check selected count from UI
 */
export async function getSelectedCount(page: Page): Promise<number> {
  const text = await page.locator('text=/Selected:.*/'). textContent();
  const match = text?.match(/Selected:\s*(\d+)/);
  return match ? parseInt(match[1]!) : 0;
}

/**
 * Multi-select objects with shift-click
 */
export async function multiSelectObjects(page: Page, positions: { x: number; y: number }[]) {
  await page.locator('[data-testid="select-tool"]').click();

  const canvas = page.locator('canvas').first();

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (i === 0) {
      await canvas.click({ position: pos });
    } else {
      await canvas.click({ position: pos, modifiers: ['Shift'] });
    }
    await page.waitForTimeout(100);
  }
}

/**
 * Select an object at position
 */
export async function selectObject(page: Page, x: number, y: number) {
  await page.locator('[data-testid="select-tool"]').click().catch(() => {
    // Select tool might not exist, that's ok
  });
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
}

/**
 * Drag an object from one position to another
 */
export async function dragObject(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(100);

  await page.mouse.move(toX, toY);
  await page.waitForTimeout(100);

  await page.mouse.up();
  await page.waitForTimeout(300);
}

/**
 * Click on canvas to select/deselect
 */
export async function clickCanvas(page: Page, x: number, y: number) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
}

/**
 * Perform pan operation on the board
 */
export async function panBoard(page: Page, deltaX: number, deltaY: number) {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();

  if (!box) throw new Error('Canvas not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: 'middle' }); // or use space + drag
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
  await page.mouse.up({ button: 'middle' });

  await page.waitForTimeout(200);
}

/**
 * Zoom the board
 */
export async function zoomBoard(page: Page, delta: number) {
  const canvas = page.locator('canvas').first();

  // Scroll to zoom
  await canvas.hover();
  await page.mouse.wheel(0, delta);

  await page.waitForTimeout(200);
}

/**
 * Delete selected objects
 */
export async function deleteSelectedObjects(page: Page) {
  await page.keyboard.press('Delete');
  await page.waitForTimeout(200);
}

/**
 * Duplicate selected objects
 */
export async function duplicateSelectedObjects(page: Page) {
  await page.keyboard.press('Control+D'); // or Command+D on Mac
  await page.waitForTimeout(200);
}

/**
 * Copy and paste selected objects
 */
export async function copyPasteObjects(page: Page) {
  await page.keyboard.press('Control+C');
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(200);
}

/**
 * Get cursor position broadcast indicator
 */
export async function getCursorElement(page: Page, userName: string) {
  return page.locator(`[data-testid="remote-cursor-${userName}"]`);
}

/**
 * Get presence bar showing online users
 */
export async function getOnlineUsers(page: Page): Promise<string[]> {
  const presenceBar = page.locator('[data-testid="presence-bar"]');
  await expect(presenceBar).toBeVisible();

  const userElements = await presenceBar.locator('[data-testid^="presence-user-"]').all();
  const userNames: string[] = [];

  for (const el of userElements) {
    const text = await el.textContent();
    if (text) userNames.push(text);
  }

  return userNames;
}

/**
 * Measure frame rate during operation
 */
export async function measureFrameRate(page: Page, durationMs: number): Promise<number> {
  const result = await page.evaluate((duration) => {
    return new Promise<number>((resolve) => {
      let frameCount = 0;
      let lastTime = performance.now();

      function countFrame() {
        frameCount++;
        const elapsed = performance.now() - lastTime;

        if (elapsed < duration) {
          requestAnimationFrame(countFrame);
        } else {
          const fps = (frameCount / elapsed) * 1000;
          resolve(fps);
        }
      }

      requestAnimationFrame(countFrame);
    });
  }, durationMs);

  return result;
}

/**
 * Measure sync latency between creating object and seeing it appear
 */
export async function measureSyncLatency(page1: Page, page2: Page): Promise<number> {
  const startTime = Date.now();

  // Create object on page1
  await createStickyNote(page1, 400, 300, 'Latency Test');

  // Wait for object to appear on page2
  // This assumes objects have data-testid attributes
  await expect(page2.locator('[data-testid^="sticky-note-"]').last()).toBeVisible({ timeout: 5000 });

  const endTime = Date.now();
  return endTime - startTime;
}

/**
 * Count objects on the board by reading hidden data-testid affordance
 */
export async function countBoardObjects(page: Page): Promise<number> {
  const el = page.locator('[data-testid="object-counts"]');
  return parseInt((await el.getAttribute('data-total')) ?? '0');
}

/**
 * Get object counts by type from hidden data-testid affordance
 */
export async function getObjectCounts(page: Page): Promise<{ notes: number; shapes: number; connectors: number; text: number; frames: number }> {
  const el = page.locator('[data-testid="object-counts"]');

  return {
    notes: parseInt((await el.getAttribute('data-notes')) ?? '0'),
    shapes: parseInt((await el.getAttribute('data-shapes')) ?? '0'),
    connectors: parseInt((await el.getAttribute('data-connectors')) ?? '0'),
    text: parseInt((await el.getAttribute('data-text')) ?? '0'),
    frames: parseInt((await el.getAttribute('data-frames')) ?? '0'),
  };
}

/**
 * Throttle network to simulate slow connection
 */
export async function throttleNetwork(page: Page, downloadKbps: number, uploadKbps: number, latencyMs: number) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (downloadKbps * 1024) / 8,
    uploadThroughput: (uploadKbps * 1024) / 8,
    latency: latencyMs,
  });
}

/**
 * Disable network to simulate disconnection
 */
export async function disconnectNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  });
}

/**
 * Re-enable network after disconnection
 */
export async function reconnectNetwork(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}

/**
 * Check if connection status indicator shows connected
 */
export async function isConnected(page: Page): Promise<boolean> {
  const indicator = page.locator('[data-testid="connection-status"]');
  const status = await indicator.getAttribute('data-status');
  return status === 'connected';
}

/**
 * Wait for reconnection after disconnect
 */
export async function waitForReconnection(page: Page, timeout = 10000) {
  await expect(page.locator('[data-testid="connection-status"][data-status="connected"]'))
    .toBeVisible({ timeout });
}
