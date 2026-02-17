# Core MVP Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add selection system, delete functionality, and basic shapes to complete the core collaborative whiteboard MVP.

**Architecture:** Building on Pattern B (Broadcast + async DB), we'll add: (1) local selection state (no broadcast needed), (2) delete with optimistic updates + broadcast, (3) shape objects using same realtime sync pattern as sticky notes.

**Tech Stack:** React + Konva.js, Supabase Realtime Broadcast, TypeScript discriminated unions

---

## Task 1: Selection System

**Files:**
- Create: `src/hooks/useSelection.ts`
- Modify: `src/pages/CursorTest.tsx:58-93`
- Modify: `src/components/canvas/StickyNote.tsx:23-24,91-93,111`

**Step 1: Write the selection hook**

Create `src/hooks/useSelection.ts`:

```typescript
/**
 * useSelection - Manages object selection state
 *
 * Selection is local-only (not synced) since each user has independent selection state
 */

import { useState, useCallback } from 'react'

interface UseSelectionReturn {
  selectedIds: Set<string>
  selectObject: (id: string) => void
  deselectObject: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
}

export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectObject = useCallback((id: string) => {
    setSelectedIds((prev) => new Set(prev).add(id))
  }, [])

  const deselectObject = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  return {
    selectedIds,
    selectObject,
    deselectObject,
    toggleSelection,
    clearSelection,
    isSelected,
  }
}
```

**Step 2: Add selection to CursorTest page**

In `src/pages/CursorTest.tsx`, replace the local selection state (line 58) with the hook:

```typescript
import { useSelection } from '../hooks/useSelection'

// Replace this line:
// const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)

// With:
const { isSelected, selectObject, clearSelection } = useSelection()
```

**Step 3: Update sticky note rendering**

In `src/pages/CursorTest.tsx`, update the sticky notes mapping (around line 176-184):

```typescript
{stickyNotes.map((note) => (
  <StickyNote
    key={note.id}
    object={note}
    onUpdate={updateObject}
    onSelect={selectObject}
    isSelected={isSelected(note.id)}
  />
))}
```

**Step 4: Add click-away to clear selection**

In `src/components/canvas/BoardStage.tsx`, add onClick handler to Stage:

```typescript
// Add new prop
interface BoardStageProps {
  children?: React.ReactNode
  onCursorMove?: (x: number, y: number) => void
  onStageClick?: () => void  // NEW
  width?: number
  height?: number
}

// In the component
export function BoardStage({
  children,
  onCursorMove,
  onStageClick,  // NEW
  width = window.innerWidth,
  height = window.innerHeight,
}: BoardStageProps) {
  // ... existing code ...

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Only trigger if clicking the stage itself (not a child)
      if (e.target === e.currentTarget) {
        onStageClick?.()
      }
    },
    [onStageClick]
  )

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      draggable={false}
      x={stagePos.x}
      y={stagePos.y}
      scaleX={stageScale}
      scaleY={stageScale}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onClick={handleStageClick}  // NEW
      style={{ cursor: 'default' }}
    >
      <Layer>{children}</Layer>
    </Stage>
  )
}
```

**Step 5: Wire up stage click in CursorTest**

In `src/pages/CursorTest.tsx`, pass clearSelection to BoardStage:

```typescript
<BoardStage onCursorMove={handleCursorMove} onStageClick={clearSelection}>
```

**Step 6: Test selection**

Manual test:
1. Open the app in browser
2. Click a sticky note - should see blue stroke (selection indicator)
3. Click another sticky note - first deselects, second selects
4. Click empty canvas - should deselect all

**Step 7: Commit**

```bash
git add src/hooks/useSelection.ts src/pages/CursorTest.tsx src/components/canvas/BoardStage.tsx src/components/canvas/StickyNote.tsx
git commit -m "feat: add selection system

- Create useSelection hook for managing selection state
- Add click-to-select on sticky notes
- Add click-away to clear selection
- Selection is local-only (not synced between clients)"
```

---

## Task 2: Delete Objects

**Files:**
- Modify: `src/pages/CursorTest.tsx:43-56,93-end`
- Modify: `src/hooks/useRealtimeSync.ts:279-304`

**Step 1: Add delete handler to CursorTest page**

In `src/pages/CursorTest.tsx`, add keyboard event listener:

```typescript
import { useState, useEffect } from 'react'

export function CursorTest() {
  // ... existing code ...

  const { isSelected, selectObject, clearSelection, selectedIds } = useSelection()

  // Add keyboard listener for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if not typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }

        e.preventDefault()

        // Delete all selected objects
        selectedIds.forEach((id) => {
          deleteObject(id)
        })

        clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, deleteObject, clearSelection])

  // ... rest of component ...
}
```

**Step 2: Add delete button to UI**

In `src/pages/CursorTest.tsx`, add a delete button in the info panel:

```typescript
<div className="space-y-2">
  <button
    onClick={handleCreateStickyNote}
    disabled={isLoading}
    className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded text-white font-medium transition"
  >
    {isLoading ? 'Creating...' : '+ Add Sticky Note'}
  </button>

  {/* NEW DELETE BUTTON */}
  <button
    onClick={() => {
      selectedIds.forEach((id) => deleteObject(id))
      clearSelection()
    }}
    disabled={selectedIds.size === 0}
    className="w-full px-3 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:bg-gray-300 rounded text-white font-medium transition"
  >
    Delete Selected ({selectedIds.size})
  </button>

  <button
    onClick={() => {
      localStorage.removeItem('test_user_id')
      localStorage.removeItem('test_user_name')
      window.location.reload()
    }}
    className="w-full px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition"
  >
    Generate New User ID
  </button>
</div>
```

**Step 3: Add logging to deleteObject**

In `src/hooks/useRealtimeSync.ts`, add logging to the delete function:

```typescript
const deleteObject = useCallback(async (id: string) => {
  try {
    console.log('🗑️ Deleting object:', id)

    // 1. Optimistic update
    setObjects((prev) => prev.filter((obj) => obj.id !== id))

    // 2. Broadcast to other clients
    if (channelRef.current) {
      console.log('📡 Broadcasting object_deleted:', id)
      channelRef.current.send({
        type: 'broadcast',
        event: 'object_deleted',
        payload: { id },
      })
    }

    // 3. Persist to database
    const { error: deleteError } = await supabase
      .from('board_objects')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('❌ Database delete error:', deleteError)
      throw deleteError
    }

    console.log('✅ Object deleted successfully:', id)
  } catch (err) {
    console.error('❌ Error deleting object:', err)
    setError(err instanceof Error ? err.message : 'Failed to delete object')
    // Note: No rollback on delete error - object stays deleted locally
  }
}, [])
```

**Step 4: Add logging to delete broadcast receiver**

In `src/hooks/useRealtimeSync.ts`, update the delete listener:

```typescript
// Listen for object deletion broadcasts
channel.on('broadcast', { event: 'object_deleted' }, ({ payload }) => {
  const { id } = payload as { id: string }
  console.log('📥 Received object_deleted broadcast:', id)
  setObjects((prev) => prev.filter((obj) => obj.id !== id))
})
```

**Step 5: Test delete functionality**

Manual test:
1. Open app in two windows (W1, W2)
2. Create several sticky notes
3. In W1: Select a sticky note and press Delete key
4. Verify: Note disappears in both W1 and W2
5. In W1: Select a note and click "Delete Selected" button
6. Verify: Note disappears in both W1 and W2
7. Check console: Should see broadcast messages

**Step 6: Commit**

```bash
git add src/pages/CursorTest.tsx src/hooks/useRealtimeSync.ts
git commit -m "feat: add delete functionality

- Add Delete/Backspace keyboard shortcut
- Add 'Delete Selected' button in UI
- Broadcast deletions to all clients
- Optimistic update + async DB persistence
- Shows count of selected objects in button"
```

---

## Task 3: Basic Shapes (Rectangle)

**Files:**
- Modify: `src/lib/database.types.ts:30-50`
- Create: `src/components/canvas/Shape.tsx`
- Modify: `src/pages/CursorTest.tsx:66-85,88-91,176-193`

**Step 1: Add shape types to database types**

In `src/lib/database.types.ts`, add shape data types:

```typescript
export interface RectangleData {
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

export interface CircleData {
  radius: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

export interface LineData {
  points: number[] // [x1, y1, x2, y2]
  strokeColor: string
  strokeWidth: number
}

// Update BoardObject discriminated union
export type BoardObject =
  | {
      id: string
      board_id: string
      type: 'sticky_note'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      z_index: number
      data: StickyNoteData
      created_by: string | null
      created_at: string
      updated_at: string
    }
  | {
      id: string
      board_id: string
      type: 'rectangle'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      z_index: number
      data: RectangleData
      created_by: string | null
      created_at: string
      updated_at: string
    }
  | {
      id: string
      board_id: string
      type: 'circle'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      z_index: number
      data: CircleData
      created_by: string | null
      created_at: string
      updated_at: string
    }
  | {
      id: string
      board_id: string
      type: 'line'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      z_index: number
      data: LineData
      created_by: string | null
      created_at: string
      updated_at: string
    }
```

**Step 2: Create Shape component**

Create `src/components/canvas/Shape.tsx`:

```typescript
/**
 * Shape - Renders basic shapes (rectangle, circle, line) on the canvas
 *
 * Features:
 * - Draggable
 * - Selectable
 * - Colored fill and stroke
 */

import { useRef } from 'react'
import { Group, Rect, Circle, Line } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject, RectangleData, CircleData, LineData } from '../../lib/database.types'

interface ShapeProps {
  object:
    | (BoardObject & { type: 'rectangle'; data: RectangleData })
    | (BoardObject & { type: 'circle'; data: CircleData })
    | (BoardObject & { type: 'line'; data: LineData })
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  onSelect?: (id: string) => void
  isSelected?: boolean
}

export function Shape({ object, onUpdate, onSelect, isSelected }: ShapeProps) {
  const groupRef = useRef<Konva.Group>(null)

  const lastDragUpdate = useRef<number>(0)
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const now = Date.now()
    const throttleMs = 50

    if (now - lastDragUpdate.current < throttleMs) {
      return
    }

    lastDragUpdate.current = now

    const group = groupRef.current
    if (!group) return

    const newX = group.x()
    const newY = group.y()

    onUpdate(object.id, {
      x: newX,
      y: newY,
    })
  }

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const group = groupRef.current
    if (!group) return

    const newX = group.x()
    const newY = group.y()

    onUpdate(object.id, {
      x: newX,
      y: newY,
    })
  }

  const handleClick = () => {
    onSelect?.(object.id)
  }

  const renderShape = () => {
    if (object.type === 'rectangle') {
      return (
        <Rect
          width={object.width}
          height={object.height}
          fill={object.data.fillColor}
          stroke={isSelected ? '#4A90E2' : object.data.strokeColor}
          strokeWidth={isSelected ? 3 : object.data.strokeWidth}
        />
      )
    }

    if (object.type === 'circle') {
      return (
        <Circle
          x={object.width / 2}
          y={object.height / 2}
          radius={object.data.radius}
          fill={object.data.fillColor}
          stroke={isSelected ? '#4A90E2' : object.data.strokeColor}
          strokeWidth={isSelected ? 3 : object.data.strokeWidth}
        />
      )
    }

    if (object.type === 'line') {
      return (
        <Line
          points={object.data.points}
          stroke={isSelected ? '#4A90E2' : object.data.strokeColor}
          strokeWidth={isSelected ? object.data.strokeWidth + 2 : object.data.strokeWidth}
        />
      )
    }

    return null
  }

  return (
    <Group
      ref={groupRef}
      x={object.x}
      y={object.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      {renderShape()}
    </Group>
  )
}
```

**Step 3: Add rectangle creation to CursorTest**

In `src/pages/CursorTest.tsx`, add a rectangle creation handler:

```typescript
import { Shape } from '../components/canvas/Shape'
import type { BoardObject, StickyNoteData, RectangleData, CircleData, LineData } from '../lib/database.types'

// Add handler after handleCreateStickyNote
const handleCreateRectangle = async () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9']
  const randomFill = colors[Math.floor(Math.random() * colors.length)]

  await createObject({
    board_id: TEST_BOARD_ID,
    type: 'rectangle',
    x: cursorPos.x || 150,
    y: cursorPos.y || 150,
    width: 200,
    height: 150,
    rotation: 0,
    z_index: objects.length,
    data: {
      fillColor: randomFill,
      strokeColor: '#2D3436',
      strokeWidth: 2,
    },
  })
}
```

**Step 4: Add rectangle button to UI**

In `src/pages/CursorTest.tsx`, add button after the sticky note button:

```typescript
<div className="space-y-2">
  <button
    onClick={handleCreateStickyNote}
    disabled={isLoading}
    className="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded text-white font-medium transition"
  >
    {isLoading ? 'Creating...' : '+ Add Sticky Note'}
  </button>

  {/* NEW RECTANGLE BUTTON */}
  <button
    onClick={handleCreateRectangle}
    disabled={isLoading}
    className="w-full px-3 py-2 text-sm bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 rounded text-white font-medium transition"
  >
    {isLoading ? 'Creating...' : '+ Add Rectangle'}
  </button>

  {/* Delete button and other buttons... */}
</div>
```

**Step 5: Render shapes in the canvas**

In `src/pages/CursorTest.tsx`, update the rendering logic:

```typescript
// Filter shapes by type
const stickyNotes = objects.filter(
  (obj): obj is BoardObject & { type: 'sticky_note'; data: StickyNoteData } =>
    obj.type === 'sticky_note'
)

const shapes = objects.filter(
  (obj): obj is BoardObject & { type: 'rectangle' | 'circle' | 'line'; data: RectangleData | CircleData | LineData } =>
    obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'line'
)

// In the render:
<BoardStage onCursorMove={handleCursorMove} onStageClick={clearSelection}>
  {/* Render shapes first (lower z-index) */}
  {shapes.map((shape) => (
    <Shape
      key={shape.id}
      object={shape}
      onUpdate={updateObject}
      onSelect={selectObject}
      isSelected={isSelected(shape.id)}
    />
  ))}

  {/* Render sticky notes */}
  {stickyNotes.map((note) => (
    <StickyNote
      key={note.id}
      object={note}
      onUpdate={updateObject}
      onSelect={selectObject}
      isSelected={isSelected(note.id)}
    />
  ))}

  {/* Render remote cursors */}
  {Array.from(cursors.values()).map((cursor) => (
    <RemoteCursor key={cursor.userId} cursor={cursor} />
  ))}
</BoardStage>
```

**Step 6: Update object count in UI**

In `src/pages/CursorTest.tsx`, update the info panel:

```typescript
<div className="text-gray-600">
  <strong>Objects:</strong> {objects.length} (Sticky: {stickyNotes.length}, Shapes: {shapes.length})
</div>
```

**Step 7: Test rectangles**

Manual test:
1. Open app in two windows
2. Click "+ Add Rectangle" in W1
3. Verify: Rectangle appears in both W1 and W2
4. Drag rectangle in W1
5. Verify: Syncs smoothly to W2
6. Select and delete rectangle
7. Verify: Deletes in both windows

**Step 8: Commit**

```bash
git add src/lib/database.types.ts src/components/canvas/Shape.tsx src/pages/CursorTest.tsx
git commit -m "feat: add basic rectangle shapes

- Add RectangleData, CircleData, LineData to type system
- Create Shape component for rendering basic shapes
- Add rectangle creation with random colors
- Shapes use same sync pattern as sticky notes
- Shapes are draggable, selectable, and deletable"
```

---

## Task 4: Add Circle and Line Shapes

**Files:**
- Modify: `src/pages/CursorTest.tsx:66-100`

**Step 1: Add circle creation handler**

In `src/pages/CursorTest.tsx`:

```typescript
const handleCreateCircle = async () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9']
  const randomFill = colors[Math.floor(Math.random() * colors.length)]

  await createObject({
    board_id: TEST_BOARD_ID,
    type: 'circle',
    x: cursorPos.x || 200,
    y: cursorPos.y || 200,
    width: 200, // Bounding box width
    height: 200, // Bounding box height
    rotation: 0,
    z_index: objects.length,
    data: {
      radius: 100,
      fillColor: randomFill,
      strokeColor: '#2D3436',
      strokeWidth: 2,
    },
  })
}
```

**Step 2: Add line creation handler**

```typescript
const handleCreateLine = async () => {
  await createObject({
    board_id: TEST_BOARD_ID,
    type: 'line',
    x: cursorPos.x || 100,
    y: cursorPos.y || 100,
    width: 200, // Bounding box
    height: 100, // Bounding box
    rotation: 0,
    z_index: objects.length,
    data: {
      points: [0, 0, 200, 100], // Line from (0,0) to (200,100) relative to group
      strokeColor: '#2D3436',
      strokeWidth: 4,
    },
  })
}
```

**Step 3: Add UI buttons**

In `src/pages/CursorTest.tsx`, add buttons:

```typescript
<button
  onClick={handleCreateCircle}
  disabled={isLoading}
  className="w-full px-3 py-2 text-sm bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded text-white font-medium transition"
>
  {isLoading ? 'Creating...' : '+ Add Circle'}
</button>

<button
  onClick={handleCreateLine}
  disabled={isLoading}
  className="w-full px-3 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 rounded text-white font-medium transition"
>
  {isLoading ? 'Creating...' : '+ Add Line'}
</button>
```

**Step 4: Test all shapes**

Manual test:
1. Create sticky note, rectangle, circle, line in W1
2. Verify: All appear in W2
3. Drag each shape
4. Verify: All sync smoothly
5. Select and delete each type
6. Verify: All delete properly

**Step 5: Commit**

```bash
git add src/pages/CursorTest.tsx
git commit -m "feat: add circle and line shapes

- Add circle creation with random colors
- Add line creation with default diagonal
- All shapes sync using Pattern B architecture
- Complete basic shape toolkit"
```

---

## Task 5: Multi-Select with Cmd/Ctrl

**Files:**
- Modify: `src/hooks/useSelection.ts:10-24`
- Modify: `src/components/canvas/StickyNote.tsx:91-93`
- Modify: `src/components/canvas/Shape.tsx:55-57`
- Modify: `src/pages/CursorTest.tsx:176-193`

**Step 1: Add multi-select to useSelection hook**

In `src/hooks/useSelection.ts`, update the interface and add multi-select method:

```typescript
interface UseSelectionReturn {
  selectedIds: Set<string>
  selectObject: (id: string, multiSelect?: boolean) => void
  deselectObject: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
}

export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectObject = useCallback((id: string, multiSelect = false) => {
    if (multiSelect) {
      // Add to existing selection
      setSelectedIds((prev) => new Set(prev).add(id))
    } else {
      // Replace selection with single object
      setSelectedIds(new Set([id]))
    }
  }, [])

  // ... rest of the hook unchanged ...
}
```

**Step 2: Update StickyNote to pass modifier key**

In `src/components/canvas/StickyNote.tsx`, update handleClick:

```typescript
const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
  const multiSelect = e.evt.metaKey || e.evt.ctrlKey
  onSelect?.(object.id, multiSelect)
}

// Update the Group component
<Group
  ref={groupRef}
  x={object.x}
  y={object.y}
  draggable
  onDragMove={handleDragMove}
  onDragEnd={handleDragEnd}
  onClick={handleClick}
  onDblClick={handleDoubleClick}
>
```

**Step 3: Update Shape to pass modifier key**

In `src/components/canvas/Shape.tsx`, update handleClick:

```typescript
const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
  const multiSelect = e.evt.metaKey || e.evt.ctrlKey
  onSelect?.(object.id, multiSelect)
}
```

**Step 4: Update component props**

In `src/pages/CursorTest.tsx`, update onSelect signature:

```typescript
interface OnSelectFn {
  (id: string, multiSelect?: boolean): void
}

// The components already use selectObject which now accepts multiSelect
```

**Step 5: Test multi-select**

Manual test:
1. Create several objects (sticky notes, shapes)
2. Click one object - should select it
3. Hold Cmd (Mac) or Ctrl (Windows) and click another object
4. Verify: Both objects are selected (both show blue stroke)
5. Click without modifier - should clear and select only one
6. Multi-select several objects and press Delete
7. Verify: All selected objects delete

**Step 6: Update UI to show selection count**

In `src/pages/CursorTest.tsx`, update the info panel:

```typescript
<div className="text-gray-600">
  <strong>Selected:</strong> {selectedIds.size}
</div>
```

**Step 7: Commit**

```bash
git add src/hooks/useSelection.ts src/components/canvas/StickyNote.tsx src/components/canvas/Shape.tsx src/pages/CursorTest.tsx
git commit -m "feat: add multi-select with Cmd/Ctrl

- Hold Cmd (Mac) or Ctrl (Windows) to add to selection
- Click without modifier clears and selects single object
- Works with all object types
- Delete all selected objects with Delete key
- Show selection count in UI"
```

---

## Summary

This plan implements the core MVP features:

✅ **Selection System** - Click to select, click-away to clear
✅ **Delete Functionality** - Keyboard shortcut + UI button with broadcast sync
✅ **Basic Shapes** - Rectangle, Circle, Line with full sync
✅ **Multi-Select** - Cmd/Ctrl modifier for multiple selection

**What's NOT in this plan (future iterations):**
- Resize handles / transform controls
- Text editing for sticky notes
- Drawing/freehand tool
- Image upload
- Frames/containers
- Copy/paste
- Undo/redo
- Color picker UI

**Architecture Consistency:**
All features follow Pattern B (Broadcast + async DB):
- Optimistic updates for instant local feedback
- Broadcast to other clients for real-time sync
- Async database persistence
- Proper handling of temp IDs

**Testing Strategy:**
Since this is early MVP, we're using manual testing with two browser windows. Each task includes specific test steps to verify sync behavior.
