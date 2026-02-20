# Connector Handles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the toolbar connector button with connection handle dots that appear on selected objects, allowing users to drag from a dot to another object to create a connector.

**Architecture:** Add a `ConnectionHandles` Konva component that renders four edge-midpoint circles on selected objects. Clicking a handle enters connecting mode, rendering a `TempConnectorLine` that follows the cursor until the user clicks another object or cancels. Remove the connector button from the toolbar entirely.

**Tech Stack:** React, react-konva (Circle, Arrow), TypeScript, Konva event system

---

### Task 1: Create ConnectionHandles component

**Files:**
- Create: `src/components/canvas/ConnectionHandles.tsx`

**Step 1: Create the component**

```tsx
import { Circle } from 'react-konva'
import type { BoardObject } from '../../lib/database.types'

interface ConnectionHandlesProps {
  object: BoardObject
  onStartConnect: (objectId: string, point: { x: number; y: number }) => void
}

const HANDLE_RADIUS = 4
const HANDLE_RADIUS_HOVER = 6
const HANDLE_FILL = '#ffffff'
const HANDLE_STROKE = '#b0b0b0'
const HANDLE_FILL_HOVER = '#4A90E2'
const HANDLE_STROKE_HOVER = '#4A90E2'

function getEdgeMidpoints(obj: BoardObject) {
  return [
    { x: obj.x + obj.width / 2, y: obj.y },                    // top
    { x: obj.x + obj.width, y: obj.y + obj.height / 2 },       // right
    { x: obj.x + obj.width / 2, y: obj.y + obj.height },       // bottom
    { x: obj.x, y: obj.y + obj.height / 2 },                   // left
  ]
}

export function ConnectionHandles({ object, onStartConnect }: ConnectionHandlesProps) {
  const points = getEdgeMidpoints(object)

  return (
    <>
      {points.map((pt, i) => (
        <Circle
          key={i}
          x={pt.x}
          y={pt.y}
          radius={HANDLE_RADIUS}
          fill={HANDLE_FILL}
          stroke={HANDLE_STROKE}
          strokeWidth={1.5}
          onMouseEnter={(e) => {
            const circle = e.target
            circle.radius(HANDLE_RADIUS_HOVER)
            circle.fill(HANDLE_FILL_HOVER)
            circle.stroke(HANDLE_STROKE_HOVER)
            const stage = circle.getStage()
            if (stage) stage.container().style.cursor = 'crosshair'
            circle.getLayer()?.batchDraw()
          }}
          onMouseLeave={(e) => {
            const circle = e.target
            circle.radius(HANDLE_RADIUS)
            circle.fill(HANDLE_FILL)
            circle.stroke(HANDLE_STROKE)
            const stage = circle.getStage()
            if (stage) stage.container().style.cursor = 'default'
            circle.getLayer()?.batchDraw()
          }}
          onClick={(e) => {
            e.cancelBubble = true
            onStartConnect(object.id, pt)
          }}
          hitStrokeWidth={8}
        />
      ))}
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/canvas/ConnectionHandles.tsx
git commit -m "feat: add ConnectionHandles component with edge midpoint dots"
```

---

### Task 2: Create TempConnectorLine component

**Files:**
- Create: `src/components/canvas/TempConnectorLine.tsx`

**Step 1: Create the component**

```tsx
import { Arrow } from 'react-konva'

interface TempConnectorLineProps {
  fromPoint: { x: number; y: number }
  toPoint: { x: number; y: number }
}

export function TempConnectorLine({ fromPoint, toPoint }: TempConnectorLineProps) {
  return (
    <Arrow
      points={[fromPoint.x, fromPoint.y, toPoint.x, toPoint.y]}
      stroke="#555555"
      strokeWidth={2}
      fill="#555555"
      pointerLength={10}
      pointerWidth={8}
      dash={[6, 3]}
      listening={false}
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/components/canvas/TempConnectorLine.tsx
git commit -m "feat: add TempConnectorLine component for in-progress connections"
```

---

### Task 3: Integrate ConnectionHandles and TempConnectorLine into CursorTest

**Files:**
- Modify: `src/pages/CursorTest.tsx`

**Step 1: Add imports**

Add at top with other canvas imports:
```tsx
import { ConnectionHandles } from '../components/canvas/ConnectionHandles'
import { TempConnectorLine } from '../components/canvas/TempConnectorLine'
```

**Step 2: Update connectorMode state**

Change the state from `{ fromId: string } | null` to include the start point:
```tsx
const [connectorMode, setConnectorMode] = useState<{ fromId: string; fromPoint: { x: number; y: number } } | null>(null)
```

**Step 3: Add mouse position state for temp line**

Add a new state for tracking cursor position during connecting:
```tsx
const [connectingCursorPos, setConnectingCursorPos] = useState({ x: 0, y: 0 })
```

**Step 4: Add hover target state for drop target highlighting**

```tsx
const [connectHoverId, setConnectHoverId] = useState<string | null>(null)
```

**Step 5: Add onStartConnect handler**

```tsx
const handleStartConnect = useCallback((objectId: string, point: { x: number; y: number }) => {
  setConnectorMode({ fromId: objectId, fromPoint: point })
  setConnectingCursorPos(point)
  clearSelection()
}, [clearSelection])
```

**Step 6: Update handleCursorMove to track connecting cursor position**

In the existing `handleCursorMove`, add:
```tsx
const handleCursorMove = useCallback((x: number, y: number) => {
  setCursorPos({ x, y })
  broadcastCursor(x, y)
  if (connectorMode) {
    setConnectingCursorPos({ x, y })
    // Check if hovering over an object for drop target highlighting
    const hoveredObj = objectsRef.current.find(obj => {
      if (obj.id === connectorMode.fromId || obj.type === 'connector') return false
      return x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height
    })
    setConnectHoverId(hoveredObj?.id ?? null)
  }
}, [broadcastCursor, connectorMode])
```

**Step 7: Update handleObjectClick for connector completion**

The existing logic already handles this — when `connectorMode` is set and user clicks a different object, `handleCreateConnector(id)` is called. Update `handleCreateConnector` to use the new state shape:
```tsx
const handleCreateConnector = useCallback((toId: string) => {
  if (!connectorMode) return
  createObject({
    board_id: boardId,
    type: 'connector',
    x: 0, y: 0, width: 0, height: 0, rotation: 0,
    z_index: objectsRef.current.length,
    data: { fromId: connectorMode.fromId, toId, style: 'arrow' } as ConnectorData,
  })
  setConnectorMode(null)
  setConnectHoverId(null)
}, [connectorMode, createObject])
```

**Step 8: Add Escape key handler to cancel connecting mode**

In the existing `useEffect` for keydown, add:
```tsx
if (e.key === 'Escape' && connectorMode) {
  setConnectorMode(null)
  setConnectHoverId(null)
  return
}
```

**Step 9: Update stage click handler to cancel connecting mode**

Update the `onStageClick` to also cancel connecting:
```tsx
const handleStageClick = useCallback(() => {
  if (connectorMode) {
    setConnectorMode(null)
    setConnectHoverId(null)
    return
  }
  clearSelection()
}, [connectorMode, clearSelection])
```

Pass `handleStageClick` to `BoardStage` instead of `clearSelection`.

**Step 10: Render ConnectionHandles for selected non-connector objects**

After the `SelectionTransformer`, render handles for each selected object (skip connectors):
```tsx
{/* Connection handle dots on selected objects */}
{!connectorMode && Array.from(selectedIds).map(id => {
  const obj = objects.find(o => o.id === id)
  if (!obj || obj.type === 'connector') return null
  return (
    <ConnectionHandles
      key={`handles-${id}`}
      object={obj}
      onStartConnect={handleStartConnect}
    />
  )
})}
```

**Step 11: Render TempConnectorLine when in connecting mode**

```tsx
{connectorMode && (
  <TempConnectorLine
    fromPoint={connectorMode.fromPoint}
    toPoint={connectingCursorPos}
  />
)}
```

**Step 12: Pass connectHoverId to object components for highlighting**

Pass `connectHoverId` as a prop to StickyNote, Shape, Frame, TextElement so they can show a blue border when hovered during connecting. For simplicity, reuse the `isSelected` visual or add a simple `isConnectTarget` boolean prop. The simplest approach: just use a highlight via Konva — we can skip this for now and add later if needed, since objects already highlight when selected.

**Step 13: Commit**

```bash
git add src/pages/CursorTest.tsx
git commit -m "feat: integrate connection handles and temp connector line into board"
```

---

### Task 4: Remove connector from toolbar

**Files:**
- Modify: `src/components/toolbar/BoardToolbar.tsx`
- Modify: `src/pages/CursorTest.tsx`

**Step 1: Remove connector button from BoardToolbar**

In `BoardToolbar.tsx`:
- Remove `"connector"` from the `Tool` type
- Remove the `connectorMode` prop from `BoardToolbarProps`
- Remove the `ConnectorIcon` component
- Remove the connector `ToolButton` JSX block and the `<Divider />` before it

**Step 2: Remove `connector` from activeTool type in CursorTest**

Change the `activeTool` type to remove `'connector'`:
```tsx
const [activeTool, setActiveTool] = useState<'select' | 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'text' | 'frame'>('select')
```

**Step 3: Remove connector case from handleToolSelect**

Remove the `if (tool === 'connector')` block from `handleToolSelect`.

**Step 4: Remove `connectorMode` prop from BoardToolbar usage**

In the JSX, remove `connectorMode={!!connectorMode}` from `<BoardToolbar>`.

**Step 5: Remove the `C` keyboard shortcut if it exists**

Search for and remove any `'c'` or `'C'` keyboard shortcut handler for connector tool.

**Step 6: Clean up cursor style**

The `style={{ cursor: connectorMode ? 'crosshair' : 'default' }}` on the outer div should stay — it's still needed since `connectorMode` is still used for the handle-based flow.

**Step 7: Commit**

```bash
git add src/components/toolbar/BoardToolbar.tsx src/pages/CursorTest.tsx
git commit -m "feat: remove connector button from toolbar, connections now via handles"
```

---

### Task 5: Test manually and fix edge cases

**Steps:**
1. Run `pnpm dev` and open a board
2. Select an object — verify four dots appear on edges
3. Click a dot — verify dashed arrow follows cursor
4. Click another object — verify connector is created
5. Click empty canvas during connecting — verify it cancels
6. Press Escape during connecting — verify it cancels
7. Verify multi-select still works (dots should show on each selected object)
8. Verify the toolbar no longer has a connector button
