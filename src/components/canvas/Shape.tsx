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
  const handleDragMove = (_e: Konva.KonvaEventObject<DragEvent>) => {
    const now = Date.now()
    const throttleMs = 50

    if (now - lastDragUpdate.current < throttleMs) {
      return
    }

    lastDragUpdate.current = now

    const group = groupRef.current
    if (!group) return

    onUpdate(object.id, {
      x: group.x(),
      y: group.y(),
    })
  }

  const handleDragEnd = (_e: Konva.KonvaEventObject<DragEvent>) => {
    const group = groupRef.current
    if (!group) return

    onUpdate(object.id, {
      x: group.x(),
      y: group.y(),
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
