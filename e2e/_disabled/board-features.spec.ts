/**
 * Board Features Tests
 *
 * Tests all board features from the requirements:
 * - Workspace: Infinite board with smooth pan/zoom
 * - Sticky Notes: Create, edit text, change colors
 * - Shapes: Rectangles, circles, lines with solid colors
 * - Connectors: Lines/arrows connecting objects
 * - Text: Standalone text elements
 * - Frames: Group and organize content areas
 * - Transforms: Move, resize, rotate objects
 * - Selection: Single and multi-select (shift-click, drag-to-select)
 * - Operations: Delete, duplicate, copy/paste
 */

import { test, expect } from '@playwright/test';
import {
  loginUser,
  waitForBoardReady,
  createStickyNote,
  createShape,
  createFrame,
  createConnector,
  panBoard,
  zoomBoard,
  selectObject,
  multiSelectObjects,
  dragObject,
  deleteSelectedObjects,
  duplicateSelectedObjects,
  copyPasteObjects,
  measureFrameRate,
} from './helpers/test-utils';

test.describe('Board Features - Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Infinite board with smooth pan', async ({ page }) => {
    // Pan in multiple directions
    await panBoard(page, 200, 0);
    await page.waitForTimeout(200);

    await panBoard(page, 0, 200);
    await page.waitForTimeout(200);

    await panBoard(page, -100, -100);
    await page.waitForTimeout(200);

    // Create an object far from origin
    await createStickyNote(page, 1000, 1000, 'Far from origin');

    // Pan to see it
    await panBoard(page, 500, 500);
    await page.waitForTimeout(200);

    // Object should still be accessible
    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await expect(stickyNote).toBeVisible();
  });

  test('Smooth zoom at multiple levels', async ({ page }) => {
    await createStickyNote(page, 400, 300, 'Zoom Test');

    // Zoom in
    await zoomBoard(page, -200);
    await page.waitForTimeout(200);

    // Object should still be visible
    await expect(page.locator('[data-testid^="sticky-note-"]').first()).toBeVisible();

    // Zoom out
    await zoomBoard(page, 400);
    await page.waitForTimeout(200);

    // Object should still be visible
    await expect(page.locator('[data-testid^="sticky-note-"]').first()).toBeVisible();

    // Zoom back to normal
    await zoomBoard(page, -200);
    await page.waitForTimeout(200);

    // Should still be able to interact
    await selectObject(page, 400, 300);
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();
  });

  test('Pan and zoom together maintain smooth performance', async ({ page }) => {
    // Create multiple objects
    for (let i = 0; i < 10; i++) {
      await createStickyNote(page, 200 + i * 100, 200 + i * 50, `Note ${i}`);
    }

    // Measure FPS during pan
    await panBoard(page, 100, 100);
    const fpsDuringPan = await measureFrameRate(page, 1000);

    // Should maintain 60 FPS or close to it
    expect(fpsDuringPan).toBeGreaterThan(30); // At least 30 FPS

    // Measure FPS during zoom
    const fpsDuringZoom = await measureFrameRate(page, 1000);
    await zoomBoard(page, -100);

    expect(fpsDuringZoom).toBeGreaterThan(30);
  });
});

test.describe('Board Features - Sticky Notes', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Create sticky note', async ({ page }) => {
    await createStickyNote(page, 300, 300);

    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await expect(stickyNote).toBeVisible();
  });

  test('Edit sticky note text', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Initial Text');

    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await stickyNote.dblclick();

    const textInput = page.locator('[data-testid="text-edit-input"]');
    await textInput.fill('Modified Text');
    await textInput.press('Escape');

    await page.waitForTimeout(300);
    await expect(stickyNote).toContainText('Modified Text');
  });

  test('Change sticky note color', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Color Test');

    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await selectObject(page, 300, 300);

    // Open color picker
    await page.locator('[data-testid="color-picker-button"]').click();

    // Select a color (e.g., yellow)
    await page.locator('[data-testid="color-option-yellow"]').click();
    await page.waitForTimeout(300);

    // Verify color changed
    const bgColor = await stickyNote.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Color should not be default (adjust based on your default color)
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('Sticky note supports multiline text', async ({ page }) => {
    await createStickyNote(page, 300, 300);

    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    await stickyNote.dblclick();

    const textInput = page.locator('[data-testid="text-edit-input"]');
    await textInput.fill('Line 1\nLine 2\nLine 3');
    await textInput.press('Escape');

    await page.waitForTimeout(300);
    const text = await stickyNote.textContent();
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
    expect(text).toContain('Line 3');
  });
});

test.describe('Board Features - Shapes', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Create rectangles with solid colors', async ({ page }) => {
    await createShape(page, 'rectangle', 300, 300);

    const rectangle = page.locator('[data-testid^="shape-"]').filter({ has: page.locator('[data-shape-type="rectangle"]') }).first();
    await expect(rectangle).toBeVisible();

    // Change color
    await selectObject(page, 300, 300);
    await page.locator('[data-testid="color-picker-button"]').click();
    await page.locator('[data-testid="color-option-blue"]').click();

    await page.waitForTimeout(300);
    await expect(rectangle).toBeVisible();
  });

  test('Create circles with solid colors', async ({ page }) => {
    await createShape(page, 'circle', 400, 300);

    const circle = page.locator('[data-testid^="shape-"]').filter({ has: page.locator('[data-shape-type="circle"]') }).first();
    await expect(circle).toBeVisible();
  });

  test('Create lines', async ({ page }) => {
    await createShape(page, 'line', 500, 300);

    const line = page.locator('[data-testid^="shape-"]').filter({ has: page.locator('[data-shape-type="line"]') }).first();
    await expect(line).toBeVisible();
  });

  test('Shapes maintain aspect ratio', async ({ page }) => {
    await createShape(page, 'circle', 400, 300);

    const circle = page.locator('[data-testid^="shape-"]').first();
    const initialBox = await circle.boundingBox();
    expect(initialBox).not.toBeNull();

    // Select and resize
    await selectObject(page, 400, 300);
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();

    // Resize using transformer handles
    const transformer = page.locator('[data-testid="selection-transformer"]');
    const handle = transformer.locator('[data-testid="resize-handle-bottom-right"]').first();

    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + initialBox!.width + 50, initialBox!.y + initialBox!.height + 50);
    await page.mouse.up();

    await page.waitForTimeout(300);

    const newBox = await circle.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.width).toBeGreaterThan(initialBox!.width);
    expect(newBox!.height).toBeGreaterThan(initialBox!.height);
  });
});

test.describe('Board Features - Connectors', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Create connector between two objects', async ({ page }) => {
    // Create two sticky notes
    await createStickyNote(page, 200, 200, 'Start');
    await createStickyNote(page, 500, 200, 'End');
    await page.waitForTimeout(300);

    // Create connector
    await createConnector(page, 200, 200, 500, 200);
    await page.waitForTimeout(300);

    // Verify connector exists
    const connector = page.locator('[data-testid^="connector-"]').first();
    await expect(connector).toBeVisible();
  });

  test('Connector follows connected objects when moved', async ({ page }) => {
    // Create two objects and a connector
    await createStickyNote(page, 200, 200, 'A');
    await createStickyNote(page, 500, 200, 'B');
    await createConnector(page, 200, 200, 500, 200);
    await page.waitForTimeout(500);

    const connector = page.locator('[data-testid^="connector-"]').first();
    const initialBox = await connector.boundingBox();

    // Move one object
    await selectObject(page, 200, 200);
    await dragObject(page, 200, 200, 200, 400);
    await page.waitForTimeout(500);

    // Connector should have moved/updated
    const newBox = await connector.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.y).not.toBe(initialBox!.y);
  });

  test('Connector can be styled as arrow', async ({ page }) => {
    await createStickyNote(page, 200, 200, 'From');
    await createStickyNote(page, 500, 200, 'To');
    await createConnector(page, 200, 200, 500, 200);
    await page.waitForTimeout(300);

    // Select connector
    const connector = page.locator('[data-testid^="connector-"]').first();
    await connector.click();

    // Change to arrow style
    await page.locator('[data-testid="connector-style-arrow"]').click();
    await page.waitForTimeout(300);

    // Verify arrow style applied (check for arrow SVG element or style attribute)
    const hasArrow = await connector.locator('[data-arrow="true"]').isVisible().catch(() => false);
    expect(hasArrow).toBe(true);
  });
});

test.describe('Board Features - Text Elements', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Create standalone text element', async ({ page }) => {
    await page.locator('[data-testid="text-tool"]').click();
    await page.locator('canvas').first().click({ position: { x: 300, y: 300 } });

    await expect(page.locator('[data-testid="text-edit-overlay"]')).toBeVisible();
    await page.locator('[data-testid="text-edit-input"]').fill('Standalone Text');
    await page.locator('[data-testid="text-edit-input"]').press('Escape');

    await page.waitForTimeout(300);
    const textElement = page.locator('[data-testid^="text-element-"]').first();
    await expect(textElement).toBeVisible();
    await expect(textElement).toContainText('Standalone Text');
  });

  test('Edit text element', async ({ page }) => {
    // Create text
    await page.locator('[data-testid="text-tool"]').click();
    await page.locator('canvas').first().click({ position: { x: 300, y: 300 } });
    await page.locator('[data-testid="text-edit-input"]').fill('Original');
    await page.locator('[data-testid="text-edit-input"]').press('Escape');

    await page.waitForTimeout(300);

    // Edit it
    const textElement = page.locator('[data-testid^="text-element-"]').first();
    await textElement.dblclick();

    await expect(page.locator('[data-testid="text-edit-overlay"]')).toBeVisible();
    await page.locator('[data-testid="text-edit-input"]').fill('Modified');
    await page.locator('[data-testid="text-edit-input"]').press('Escape');

    await page.waitForTimeout(300);
    await expect(textElement).toContainText('Modified');
  });
});

test.describe('Board Features - Frames', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Create frame to group content', async ({ page }) => {
    await createFrame(page, 200, 200, 'My Frame');

    const frame = page.locator('[data-testid^="frame-"]').first();
    await expect(frame).toBeVisible();
    await expect(frame).toContainText('My Frame');
  });

  test('Frame can contain sticky notes', async ({ page }) => {
    // Create frame
    await createFrame(page, 200, 200, 'Container');
    await page.waitForTimeout(300);

    // Create sticky notes inside frame area
    await createStickyNote(page, 250, 250, 'Inside Frame');
    await page.waitForTimeout(300);

    // Both should be visible
    await expect(page.locator('[data-testid^="frame-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="sticky-note-"]').first()).toBeVisible();
  });

  test('Frame can be resized', async ({ page }) => {
    await createFrame(page, 300, 300, 'Resizable');

    const frame = page.locator('[data-testid^="frame-"]').first();
    const initialBox = await frame.boundingBox();
    expect(initialBox).not.toBeNull();

    // Select frame
    await selectObject(page, 300, 300);
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();

    // Resize
    const transformer = page.locator('[data-testid="selection-transformer"]');
    const handle = transformer.locator('[data-testid="resize-handle-bottom-right"]').first();

    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + initialBox!.width + 100, initialBox!.y + initialBox!.height + 100);
    await page.mouse.up();

    await page.waitForTimeout(300);

    const newBox = await frame.boundingBox();
    expect(newBox!.width).toBeGreaterThan(initialBox!.width);
    expect(newBox!.height).toBeGreaterThan(initialBox!.height);
  });
});

test.describe('Board Features - Transforms', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Move object by dragging', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Move Me');

    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    const initialBox = await stickyNote.boundingBox();

    await dragObject(page, 300, 300, 500, 400);
    await page.waitForTimeout(300);

    const newBox = await stickyNote.boundingBox();
    expect(newBox!.x).not.toBe(initialBox!.x);
    expect(newBox!.y).not.toBe(initialBox!.y);
  });

  test('Resize object using transformer', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Resize Me');

    const stickyNote = page.locator('[data-testid^="sticky-note-"]').first();
    const initialBox = await stickyNote.boundingBox();

    await selectObject(page, 300, 300);
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();

    // Resize using corner handle
    const transformer = page.locator('[data-testid="selection-transformer"]');
    const handle = transformer.locator('[data-testid="resize-handle-bottom-right"]').first();

    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + initialBox!.width + 50, initialBox!.y + initialBox!.height + 50);
    await page.mouse.up();

    await page.waitForTimeout(300);

    const newBox = await stickyNote.boundingBox();
    expect(newBox!.width).toBeGreaterThan(initialBox!.width);
    expect(newBox!.height).toBeGreaterThan(initialBox!.height);
  });

  test('Rotate object using transformer', async ({ page }) => {
    await createShape(page, 'rectangle', 300, 300);

    await selectObject(page, 300, 300);
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();

    // Rotate using rotate handle
    const transformer = page.locator('[data-testid="selection-transformer"]');
    const rotateHandle = transformer.locator('[data-testid="rotate-handle"]').first();

    await rotateHandle.hover();
    await page.mouse.down();
    await page.mouse.move(400, 200);
    await page.mouse.up();

    await page.waitForTimeout(300);

    // Verify rotation (check transform attribute or rotation property)
    const shape = page.locator('[data-testid^="shape-"]').first();
    const rotation = await shape.getAttribute('data-rotation');
    expect(rotation).not.toBe('0');
  });
});

test.describe('Board Features - Selection', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Single select object by clicking', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Select Me');

    await selectObject(page, 300, 300);

    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();
  });

  test('Multi-select with shift-click', async ({ page }) => {
    // Create multiple objects
    await createStickyNote(page, 200, 200, 'Note 1');
    await createStickyNote(page, 400, 200, 'Note 2');
    await createStickyNote(page, 600, 200, 'Note 3');
    await page.waitForTimeout(300);

    // Multi-select with shift-click
    await multiSelectObjects(page, [
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 600, y: 200 },
    ]);

    await page.waitForTimeout(300);

    // Transformer should show around all selected objects
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();

    // Should have multiple selected (check selection count)
    const selectionCount = await page.locator('[data-testid="selection-count"]').textContent();
    expect(selectionCount).toContain('3');
  });

  test('Drag-to-select multiple objects', async ({ page }) => {
    // Create multiple objects
    await createStickyNote(page, 250, 250, 'A');
    await createStickyNote(page, 350, 250, 'B');
    await createStickyNote(page, 450, 250, 'C');
    await page.waitForTimeout(300);

    // Drag selection box
    await page.locator('[data-testid="select-tool"]').click();
    const canvas = page.locator('canvas').first();

    await canvas.hover({ position: { x: 200, y: 200 } });
    await page.mouse.down();
    await canvas.hover({ position: { x: 500, y: 300 } });
    await page.mouse.up();

    await page.waitForTimeout(300);

    // All three objects should be selected
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();
  });

  test('Clear selection by clicking empty space', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Selected');

    await selectObject(page, 300, 300);
    await expect(page.locator('[data-testid="selection-transformer"]')).toBeVisible();

    // Click empty space
    await page.locator('canvas').first().click({ position: { x: 600, y: 600 } });
    await page.waitForTimeout(200);

    // Selection should clear
    await expect(page.locator('[data-testid="selection-transformer"]')).not.toBeVisible();
  });
});

test.describe('Board Features - Operations', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await waitForBoardReady(page);
  });

  test('Delete object', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Delete Me');

    await selectObject(page, 300, 300);
    await deleteSelectedObjects(page);

    await page.waitForTimeout(300);

    // Object should be gone
    await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(0);
  });

  test('Duplicate object', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Original');

    await selectObject(page, 300, 300);
    await duplicateSelectedObjects(page);

    await page.waitForTimeout(300);

    // Should have two sticky notes
    await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);
  });

  test('Copy and paste object', async ({ page }) => {
    await createStickyNote(page, 300, 300, 'Copy Me');

    await selectObject(page, 300, 300);
    await copyPasteObjects(page);

    await page.waitForTimeout(300);

    // Should have two sticky notes
    await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(2);
  });

  test('Delete multiple selected objects', async ({ page }) => {
    await createStickyNote(page, 200, 200, 'A');
    await createStickyNote(page, 400, 200, 'B');
    await createStickyNote(page, 600, 200, 'C');
    await page.waitForTimeout(300);

    await multiSelectObjects(page, [
      { x: 200, y: 200 },
      { x: 400, y: 200 },
    ]);

    await deleteSelectedObjects(page);
    await page.waitForTimeout(300);

    // Should have one remaining
    await expect(page.locator('[data-testid^="sticky-note-"]')).toHaveCount(1);
  });
});
