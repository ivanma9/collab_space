# Color Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a color swatch button to the toolbar that sets a default color for new objects and changes the color of selected objects.

**Architecture:** A `ColorButton` component lives in `BoardToolbar`. `CursorTest` owns `activeColor` state and a `handleColorChange` handler. When objects are selected, `handleColorChange` calls `updateObject` for each; otherwise it updates `activeColor`. All object-creation handlers use `activeColor` instead of random colors.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library

---

## Color Field Mapping (reference)

| Object type   | Color field         |
|---------------|---------------------|
| sticky_note   | `data.color`        |
| rectangle     | `data.fillColor`    |
| circle        | `data.fillColor`    |
| line          | `data.strokeColor`  |
| text          | `data.color`        |
| frame         | `data.backgroundColor` |
| connector     | (skip — no fill)    |

## Palette (8 swatches)

`#FFD700` `#FF6B6B` `#4ECDC4` `#45B7D1` `#96CEB4` `#A29BFE` `#FFA07A` `#DFE6E9`

---

### Task 1: Add `ColorButton` to `BoardToolbar`

**Files:**
- Modify: `src/components/toolbar/BoardToolbar.tsx`

**Step 1: Add new props to `BoardToolbarProps`**

Add to the interface:

```ts
interface BoardToolbarProps {
  // ... existing props
  activeColor: string
  onColorChange: (color: string) => void
  hasSelection: boolean
}
```

**Step 2: Add the `ColorButton` component (inside the same file, above `BoardToolbar`)**

```tsx
const PALETTE = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#A29BFE', '#FFA07A', '#DFE6E9'] as const

function ColorButton({
  activeColor,
  onColorChange,
}: {
  activeColor: string
  onColorChange: (color: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative group">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
        title="Color"
        data-testid="color-button"
      >
        <span
          className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-300"
          style={{ background: activeColor }}
        />
      </button>

      {/* Tooltip */}
      {!open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
          Color
        </div>
      )}

      {/* Swatch popover */}
      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-2 flex gap-1.5"
          data-testid="color-popover"
        >
          {PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorChange(color)
                setOpen(false)
              }}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
              style={{
                background: color,
                borderColor: color === activeColor ? '#4A90E2' : 'transparent',
                boxShadow: color === activeColor ? '0 0 0 2px #4A90E2' : undefined,
              }}
              title={color}
              data-testid={`color-swatch-${color}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Add `ColorButton` to the toolbar JSX**

In `BoardToolbar`'s return, insert between the connector divider and delete button:

```tsx
<Divider />
<ColorButton activeColor={activeColor} onColorChange={onColorChange} />
<Divider />
{/* Delete */}
```

Also destructure the new props in the function signature:

```tsx
export function BoardToolbar({
  activeTool,
  onToolSelect,
  onDelete,
  canDelete,
  deleteCount,
  isLoading,
  connectorMode,
  activeColor,
  onColorChange,
  hasSelection, // reserved for future visual hint — not needed for logic yet
}: BoardToolbarProps) {
```

**Step 4: Verify TypeScript compiles**

```bash
cd /Users/ivanma/Desktop/gauntlet/Colab/collab_space && pnpm tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change)

**Step 5: Commit**

```bash
git add src/components/toolbar/BoardToolbar.tsx
git commit -m "feat: add ColorButton with swatch popover to BoardToolbar"
```

---

### Task 2: Wire color state into `CursorTest`

**Files:**
- Modify: `src/pages/CursorTest.tsx`

**Step 1: Add `activeColor` state and remove random color constants**

After the existing `useState` declarations (around line 157), add:

```tsx
const [activeColor, setActiveColor] = useState<string>('#FFD700')
```

Remove (or keep as fallback) `STICKY_NOTE_COLORS` and `SHAPE_COLORS` constants — they are no longer used for creation.

**Step 2: Add `handleColorChange`**

After the `handleDuplicate` callback, add:

```tsx
const handleColorChange = useCallback((color: string) => {
  setActiveColor(color)
  if (selectedIds.size === 0) return

  selectedIds.forEach((id) => {
    const obj = objects.find((o) => o.id === id)
    if (!obj) return

    if (obj.type === 'sticky_note') {
      void updateObject(id, { data: { ...obj.data, color } })
    } else if (obj.type === 'rectangle') {
      void updateObject(id, { data: { ...obj.data, fillColor: color } })
    } else if (obj.type === 'circle') {
      void updateObject(id, { data: { ...obj.data, fillColor: color } })
    } else if (obj.type === 'line') {
      void updateObject(id, { data: { ...obj.data, strokeColor: color } })
    } else if (obj.type === 'text') {
      void updateObject(id, { data: { ...obj.data, color } })
    } else if (obj.type === 'frame') {
      void updateObject(id, { data: { ...obj.data, backgroundColor: color } })
    }
  })
}, [selectedIds, objects, updateObject])
```

**Step 3: Update all creation handlers to use `activeColor`**

Replace random color picks in each handler:

- `handleCreateStickyNote`: replace `randomColor` with `activeColor` in `data.color`
- `handleCreateRectangle`: replace `randomFill` with `activeColor` in `data.fillColor`
- `handleCreateCircle`: replace `randomFill` with `activeColor` in `data.fillColor`
- `handleCreateLine`: add `strokeColor: activeColor` (was `'#2D3436'`)
- `handleCreateText`: change `data.color` from `'#000000'` to `activeColor`
- `handleCreateFrame`: change `backgroundColor` from `'rgba(240,240,240,0.5)'` to `activeColor`

Each handler depends on `activeColor`, so add it to their `useCallback` dependency arrays.

**Step 4: Pass new props to `BoardToolbar`**

Find the `<BoardToolbar ...>` JSX (around line 648) and add:

```tsx
<BoardToolbar
  activeTool={activeTool}
  onToolSelect={handleToolSelect}
  onDelete={handleDelete}
  canDelete={selectedIds.size > 0}
  deleteCount={selectedIds.size}
  isLoading={isLoading}
  connectorMode={!!connectorMode}
  activeColor={activeColor}
  onColorChange={handleColorChange}
  hasSelection={selectedIds.size > 0}
/>
```

**Step 5: Verify TypeScript compiles**

```bash
cd /Users/ivanma/Desktop/gauntlet/Colab/collab_space && pnpm tsc --noEmit
```

Expected: no errors

**Step 6: Commit**

```bash
git add src/pages/CursorTest.tsx
git commit -m "feat: wire activeColor state and handleColorChange into CursorTest"
```

---

### Task 3: Manual smoke test

**Step 1: Start dev server**

```bash
cd /Users/ivanma/Desktop/gauntlet/Colab/collab_space && pnpm dev
```

**Step 2: Verify these behaviors in the browser**

1. Color button (filled circle) appears in the toolbar
2. Clicking it opens a popover with 8 swatches
3. Clicking a swatch closes the popover and updates the button color
4. Creating a sticky note uses the selected color (not random)
5. Creating a rectangle/circle uses the selected color
6. Selecting an existing sticky note, then clicking a swatch → note changes color in real-time
7. Selecting a rectangle, clicking a swatch → rectangle fill changes
8. Clicking canvas (deselect), then picking a color → next object uses that color

**Step 3: Commit if all looks good**

```bash
git add -p  # stage any minor fixups
git commit -m "chore: smoke test verified color picker feature"
```
