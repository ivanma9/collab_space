# Board Preview Cards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat board list on the Dashboard with a grid of clickable card widgets that each render a live mini-canvas preview of the board's objects.

**Architecture:** A new `BoardCard` component owns a native HTML `<canvas>` that draws a scaled, read-only snapshot of board objects. The Dashboard fetches all objects for visible boards in a single batched Supabase query (`board_id IN [...]`), groups them client-side, and passes them to each card. No Konva overhead in the preview.

**Tech Stack:** React 19, TypeScript, native Canvas 2D API, Supabase, Tailwind CSS v4

---

### Task 1: Create `BoardCard` component with canvas preview

**Files:**
- Create: `src/components/BoardCard.tsx`

**Step 1: Write the component**

```tsx
import { useEffect, useRef } from 'react'
import type { BoardObject, StickyNoteData, RectangleData, CircleData, LineData, FrameData, TextData } from '../lib/database.types'

interface BoardCardProps {
  id: string
  name: string
  inviteCode: string
  objects: BoardObject[]
  onClick: () => void
}

const PREVIEW_W = 280
const PREVIEW_H = 160

function drawPreview(ctx: CanvasRenderingContext2D, objects: BoardObject[]) {
  ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H)

  // Background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)

  if (objects.length === 0) {
    // Dot grid placeholder
    ctx.fillStyle = '#d1d5db'
    for (let x = 12; x < PREVIEW_W; x += 20) {
      for (let y = 12; y < PREVIEW_H; y += 20) {
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const obj of objects) {
    minX = Math.min(minX, obj.x)
    minY = Math.min(minY, obj.y)
    maxX = Math.max(maxX, obj.x + (obj.width || 0))
    maxY = Math.max(maxY, obj.y + (obj.height || 0))
  }

  const pad = 16
  const bboxW = maxX - minX || 1
  const bboxH = maxY - minY || 1
  const scale = Math.min((PREVIEW_W - pad * 2) / bboxW, (PREVIEW_H - pad * 2) / bboxH, 1)
  const offsetX = pad + ((PREVIEW_W - pad * 2) - bboxW * scale) / 2
  const offsetY = pad + ((PREVIEW_H - pad * 2) - bboxH * scale) / 2

  const tx = (worldX: number) => offsetX + (worldX - minX) * scale
  const ty = (worldY: number) => offsetY + (worldY - minY) * scale

  // Sort by z_index
  const sorted = [...objects].sort((a, b) => a.z_index - b.z_index)

  for (const obj of sorted) {
    const x = tx(obj.x)
    const y = ty(obj.y)
    const w = obj.width * scale
    const h = obj.height * scale

    ctx.save()

    if (obj.type === 'sticky_note') {
      const d = obj.data as StickyNoteData
      ctx.fillStyle = d.color
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      roundRect(ctx, x, y, w, h, 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.font = `${Math.max(7, 9 * scale)}px Arial`
      ctx.fillText(d.text, x + 3, y + 10 * scale, w - 6)

    } else if (obj.type === 'rectangle') {
      const d = obj.data as RectangleData
      ctx.fillStyle = d.fillColor
      ctx.strokeStyle = d.strokeColor
      ctx.lineWidth = Math.max(0.5, d.strokeWidth * scale)
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)

    } else if (obj.type === 'circle') {
      const d = obj.data as CircleData
      ctx.fillStyle = d.fillColor
      ctx.strokeStyle = d.strokeColor
      ctx.lineWidth = Math.max(0.5, d.strokeWidth * scale)
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

    } else if (obj.type === 'line') {
      const d = obj.data as LineData
      const pts = d.points
      if (pts.length >= 4) {
        ctx.strokeStyle = d.strokeColor
        ctx.lineWidth = Math.max(0.5, d.strokeWidth * scale)
        ctx.beginPath()
        ctx.moveTo(tx(obj.x + pts[0]), ty(obj.y + pts[1]))
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(tx(obj.x + pts[i]), ty(obj.y + pts[i + 1]))
        }
        ctx.stroke()
      }

    } else if (obj.type === 'frame') {
      const d = obj.data as FrameData
      ctx.fillStyle = d.backgroundColor ?? '#ffffff'
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      if (d.title) {
        ctx.fillStyle = '#475569'
        ctx.font = `bold ${Math.max(6, 8 * scale)}px Arial`
        ctx.fillText(d.title, x + 3, y - 4, w)
      }

    } else if (obj.type === 'text') {
      const d = obj.data as TextData
      ctx.fillStyle = d.color
      ctx.font = `${Math.max(7, (d.fontSize ?? 14) * scale)}px ${d.fontFamily ?? 'Arial'}`
      ctx.fillText(d.text, x, y + 12 * scale, w)
    }

    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export function BoardCard({ id: _id, name, inviteCode, objects, onClick }: BoardCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawPreview(ctx, objects)
  }, [objects])

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-xl shadow hover:shadow-lg transition-shadow overflow-hidden text-left w-full"
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="w-full block"
        style={{ height: PREVIEW_H }}
      />
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors truncate">
          {name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 font-mono">{inviteCode}</p>
      </div>
    </button>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors related to `BoardCard.tsx`

**Step 3: Commit**

```bash
git add src/components/BoardCard.tsx
git commit -m "feat: add BoardCard component with canvas preview"
```

---

### Task 2: Update Dashboard to fetch objects and render grid

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Add objects state and batched fetch**

In `DashboardInner`, after boards are loaded, fetch objects:

```tsx
const [boardObjects, setBoardObjects] = useState<Record<string, BoardObject[]>>({})

// After setBoards(boardList), add:
if (boardList.length > 0) {
  const ids = boardList.map(b => b.id)
  supabase
    .from('board_objects')
    .select('*')
    .in('board_id', ids)
    .limit(500)
    .then(({ data }) => {
      if (!data) return
      const grouped: Record<string, BoardObject[]> = {}
      for (const obj of data) {
        if (!grouped[obj.board_id]) grouped[obj.board_id] = []
        grouped[obj.board_id].push(obj as BoardObject)
      }
      setBoardObjects(grouped)
    })
}
```

**Step 2: Replace board list with grid of BoardCard**

Replace the `{/* Board List */}` section:

```tsx
import { BoardCard } from '../components/BoardCard'

{/* Board Grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {boards.length === 0 ? (
    <p className="col-span-full text-gray-400 text-sm text-center py-8">
      No boards yet. Create one or join with a code.
    </p>
  ) : (
    boards.map(board => (
      <BoardCard
        key={board.id}
        id={board.id}
        name={board.name}
        inviteCode={board.invite_code}
        objects={boardObjects[board.id] ?? []}
        onClick={() => navigate({ to: '/board/$boardId', params: { boardId: board.id } })}
      />
    ))
  )}
</div>
```

**Step 3: Widen the container** (max-w-2xl → max-w-5xl):

```tsx
<div className="max-w-5xl mx-auto space-y-8">
```

**Step 4: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors

**Step 5: Run dev server and visually verify**

```bash
pnpm dev
```

Open dashboard — boards should appear as preview cards in a grid.

**Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: replace board list with preview card grid"
```

---

### Done

The dashboard now shows a responsive grid of board preview cards. Each card renders up to 500 objects (across all boards) from a single batched query, scaled and fit into a 280×160 native canvas thumbnail.
