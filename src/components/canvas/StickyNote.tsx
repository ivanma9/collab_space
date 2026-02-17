/**
 * StickyNote - Renders a draggable sticky note on the canvas
 *
 * Features:
 * - Draggable
 * - Editable text (double-click)
 * - Colored background
 * - Shadow for depth
 */

import { useRef, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject, StickyNoteData } from '../../lib/database.types'

interface StickyNoteProps {
  object: BoardObject & { type: 'sticky_note'; data: StickyNoteData }
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  onSelect?: (id: string) => void
  isSelected?: boolean
}

export function StickyNote({ object, onUpdate, onSelect, isSelected }: StickyNoteProps) {
  const groupRef = useRef<Konva.Group>(null)
  const [isEditing, setIsEditing] = useState(false)

  /**
   * Handle drag move - broadcast position updates during drag for smooth sync
   * Throttled to prevent too many updates
   */
  const lastDragUpdate = useRef<number>(0)
  const handleDragMove = (_e: Konva.KonvaEventObject<DragEvent>) => {
    const now = Date.now()
    const throttleMs = 50 // ~20 updates/second

    // Throttle drag updates
    if (now - lastDragUpdate.current < throttleMs) {
      return
    }

    lastDragUpdate.current = now

    const group = groupRef.current
    if (!group) return

    const newX = group.x()
    const newY = group.y()

    // Broadcast position update during drag for smooth remote sync
    onUpdate(object.id, {
      x: newX,
      y: newY,
    })
  }

  /**
   * Handle drag end - final position update with DB persistence
   */
  const handleDragEnd = (_e: Konva.KonvaEventObject<DragEvent>) => {
    const group = groupRef.current
    if (!group) return

    // Get the final position after drag
    const newX = group.x()
    const newY = group.y()

    console.log(`[StickyNote] Drag ended for ${object.id.substring(0, 20)}... at position (${Math.round(newX)}, ${Math.round(newY)})`)

    // Update the object position (will persist to DB)
    onUpdate(object.id, {
      x: newX,
      y: newY,
    })
  }

  /**
   * Handle double-click - enter edit mode
   * TODO: Implement text editing in a future iteration
   */
  const handleDoubleClick = () => {
    setIsEditing(true)
    onSelect?.(object.id)
    // Text editing will be implemented with a textarea overlay
    // For now, just show that double-click is detected
    console.log('Double-clicked sticky note:', object.id)
  }

  /**
   * Handle single click - select
   */
  const handleClick = () => {
    onSelect?.(object.id)
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
      onDblClick={handleDoubleClick}
    >
      {/* Sticky note background */}
      <Rect
        width={object.width}
        height={object.height}
        fill={object.data.color}
        stroke={isSelected ? '#4A90E2' : undefined}
        strokeWidth={isSelected ? 3 : 0}
        cornerRadius={4}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.3}
        shadowOffset={{ x: 2, y: 2 }}
      />

      {/* Sticky note text */}
      <Text
        text={object.data.text}
        x={10}
        y={10}
        width={object.width - 20}
        height={object.height - 20}
        fontSize={14}
        fontFamily="Arial, sans-serif"
        fill="#000000"
        align="left"
        verticalAlign="top"
        wrap="word"
      />

      {/* Edit indicator when editing */}
      {isEditing && (
        <Rect
          width={object.width}
          height={object.height}
          stroke="#4A90E2"
          strokeWidth={2}
          cornerRadius={4}
          dash={[5, 5]}
        />
      )}
    </Group>
  )
}
