/**
 * StickyNote - Renders a draggable sticky note on the canvas
 *
 * Features:
 * - Draggable
 * - Editable text (double-click)
 * - Colored background
 * - Shadow for depth
 */

import { useRef, useEffect } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import type { BoardObject, StickyNoteData } from '../../lib/database.types'

interface StickyNoteProps {
  object: BoardObject & { type: 'sticky_note'; data: StickyNoteData }
  onUpdate: (id: string, updates: Partial<BoardObject>) => void
  onSelect?: (id: string, multiSelect?: boolean) => void
  isSelected?: boolean
  isEditing?: boolean
  onStartEdit?: (id: string) => void
  onMount?: (id: string, node: Konva.Group) => void
  onUnmount?: (id: string) => void
}

export function StickyNote({ object, onUpdate, onSelect, isSelected, isEditing, onStartEdit, onMount, onUnmount }: StickyNoteProps) {
  const groupRef = useRef<Konva.Group>(null)

  const onMountRef = useRef(onMount)
  const onUnmountRef = useRef(onUnmount)
  onMountRef.current = onMount
  onUnmountRef.current = onUnmount

  useEffect(() => {
    if (groupRef.current) onMountRef.current?.(object.id, groupRef.current)
    return () => onUnmountRef.current?.(object.id)
  }, [object.id])

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

    // Update the object position (will persist to DB)
    onUpdate(object.id, {
      x: newX,
      y: newY,
    })
  }

  /**
   * Handle double-click - enter edit mode via overlay
   */
  const handleDoubleClick = () => {
    onSelect?.(object.id)
    onStartEdit?.(object.id)
  }

  /**
   * Handle single click - select (with Cmd/Ctrl for multi-select)
   */
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const multiSelect = e.evt.metaKey || e.evt.ctrlKey
    onSelect?.(object.id, multiSelect)
  }

  return (
    <Group
      ref={groupRef}
      id={object.id}
      x={object.x}
      y={object.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      data-testid={`sticky-note-${object.id}`}
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

      {/* Sticky note text — hidden while editing (textarea overlay takes over) */}
      <Text
        text={isEditing ? '' : object.data.text}
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

    </Group>
  )
}
